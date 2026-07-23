"""
Automação diária — prospecção de leads + análise de conformidade + Excel + e-mail.

Uso:
  python main.py --regiao=Sudeste --limit=5 --dry-run
  python main.py                     # região do rodízio + envio real
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# Garante imports relativos à pasta leads_automation/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (  # noqa: E402
    DEFAULT_LIMIT,
    EXCEL_PATH,
    LOG_DIR,
    REGIOES,
    ROTATION_PATH,
)
from modules.compliance_analyzer import analyze_site  # noqa: E402
from modules.email_sender import build_body, send_report  # noqa: E402
from modules.excel_consolidator import append_leads, ensure_workbook  # noqa: E402
from modules.lead_finder import find_leads  # noqa: E402

BRT = ZoneInfo("America/Sao_Paulo")


def setup_logging() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOG_DIR / f"run-{datetime.now(BRT).strftime('%Y%m%d')}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_file, encoding="utf-8"),
        ],
    )


def next_regiao(override: str | None = None, advance: bool = True) -> str:
    if override:
        if override not in REGIOES:
            raise SystemExit(f"Região inválida: {override}. Use: {', '.join(REGIOES)}")
        return override

    ROTATION_PATH.parent.mkdir(parents=True, exist_ok=True)
    idx = 0
    if ROTATION_PATH.exists():
        try:
            data = json.loads(ROTATION_PATH.read_text(encoding="utf-8"))
            idx = int(data.get("next_index", 0)) % len(REGIOES)
        except (json.JSONDecodeError, ValueError, TypeError):
            idx = 0

    regiao = REGIOES[idx]
    if advance:
        next_idx = (idx + 1) % len(REGIOES)
        ROTATION_PATH.write_text(
            json.dumps(
                {
                    "last_regiao": regiao,
                    "last_run": datetime.now(BRT).isoformat(),
                    "next_index": next_idx,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    return regiao


def run(regiao: str, limit: int, dry_run: bool, skip_email: bool) -> None:
    log = logging.getLogger("main")
    log.info("=== Início | região=%s | limit=%s | dry_run=%s ===", regiao, limit, dry_run)

    ensure_workbook(EXCEL_PATH)

    leads = find_leads(regiao=regiao, limit=limit)
    if not leads:
        log.warning("Nenhum lead encontrado — encerrando ciclo")
        return

    coleta = datetime.now(BRT).strftime("%Y-%m-%d")
    excel_rows: list[dict] = []
    alto = critico = 0
    analisados = 0

    for lead in leads:
        try:
            result = analyze_site(lead.website)
        except Exception as e:  # noqa: BLE001 — resiliência por lead
            log.exception("Erro na análise de %s: %s", lead.website, e)
            continue

        analisados += 1
        if result.risco == "Alto":
            alto += 1
        elif result.risco == "Crítico":
            critico += 1

        excel_rows.append(
            {
                "Data da Coleta": coleta,
                "Região": lead.regiao or regiao,
                "Estado": lead.estado,
                "Cidade": lead.cidade,
                "Categoria": lead.categoria,
                "Nome do Negócio": lead.nome,
                "Website": lead.website,
                "Telefone": lead.telefone,
                "WhatsApp": lead.whatsapp,
                "E-mail": lead.email,
                "Score de Conformidade": result.score,
                "Nível de Risco": result.risco,
            }
        )
        log.info(
            "OK %s | score=%s risco=%s veredito=%s area=%s",
            lead.nome[:40],
            result.score,
            result.risco,
            result.veredito,
            result.area,
        )

    if dry_run:
        log.info("[dry-run] Excel NÃO atualizado (%s linhas simuladas)", len(excel_rows))
        novos, dupes = len(excel_rows), 0
    else:
        novos, dupes = append_leads(excel_rows, path=EXCEL_PATH)

    body = build_body(
        regiao=regiao,
        novos=novos,
        analisados=analisados,
        alto=alto,
        critico=critico,
        duplicados=dupes,
    )
    subject = f"[Veltro] Relatório conformidade — {regiao} — {coleta}"

    if skip_email or dry_run:
        send_report(subject, body, attachment=EXCEL_PATH if not dry_run else None, dry_run=True)
    else:
        send_report(subject, body, attachment=EXCEL_PATH, dry_run=False)

    log.info(
        "=== Fim | analisados=%s | novos_excel=%s | alto=%s | critico=%s ===",
        analisados,
        novos,
        alto,
        critico,
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Prospecção + conformidade Veltro Digital")
    p.add_argument("--regiao", choices=REGIOES, default=None, help="Força região (pula rodízio)")
    p.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Máx. leads no ciclo")
    p.add_argument("--dry-run", action="store_true", help="Não grava Excel nem envia e-mail")
    p.add_argument("--skip-email", action="store_true", help="Grava Excel mas não envia e-mail")
    return p.parse_args()


def main() -> None:
    setup_logging()
    args = parse_args()
    # dry-run / --regiao: não avança o rodízio
    advance = not args.dry_run and args.regiao is None
    regiao = next_regiao(args.regiao, advance=advance)
    run(regiao=regiao, limit=args.limit, dry_run=args.dry_run, skip_email=args.skip_email)


if __name__ == "__main__":
    main()
