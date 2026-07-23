"""Consolidação acumulativa em Excel (append + dedupe por website)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

import pandas as pd

from config import EXCEL_COLUMNS, EXCEL_PATH

log = logging.getLogger(__name__)


def _domain(url: str) -> str:
    if not url:
        return ""
    host = urlparse(url if url.startswith("http") else f"https://{url}").netloc.lower()
    return host.removeprefix("www.")


def ensure_workbook(path: Path | None = None) -> Path:
    path = path or EXCEL_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        df = pd.DataFrame(columns=EXCEL_COLUMNS)
        df.to_excel(path, index=False, engine="openpyxl")
        log.info("Excel criado: %s", path)
    return path


def load_existing(path: Path | None = None) -> pd.DataFrame:
    path = ensure_workbook(path)
    df = pd.read_excel(path, engine="openpyxl")
    for col in EXCEL_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    return df[EXCEL_COLUMNS]


def append_leads(
    rows: Iterable[dict],
    path: Path | None = None,
    skip_duplicates: bool = True,
) -> tuple[int, int]:
    """
    Append seguro: lê Excel existente, concatena, salva.
    Retorna (novos_inseridos, duplicados_ignorados).
    """
    path = ensure_workbook(path)
    existing = load_existing(path)
    known = {_domain(u) for u in existing["Website"].astype(str).tolist() if u}

    new_rows: list[dict] = []
    dupes = 0
    for row in rows:
        website = str(row.get("Website", "") or "")
        dom = _domain(website)
        if skip_duplicates and dom and dom in known:
            dupes += 1
            continue
        # Normaliza ordem das colunas
        clean = {c: row.get(c, "") for c in EXCEL_COLUMNS}
        new_rows.append(clean)
        if dom:
            known.add(dom)

    if not new_rows:
        log.info("Nenhuma linha nova para inserir (duplicados=%s)", dupes)
        return 0, dupes

    updated = pd.concat([existing, pd.DataFrame(new_rows)], ignore_index=True)
    updated.to_excel(path, index=False, engine="openpyxl")
    log.info("Excel atualizado: +%s linhas | duplicados ignorados=%s | arquivo=%s", len(new_rows), dupes, path)
    return len(new_rows), dupes
