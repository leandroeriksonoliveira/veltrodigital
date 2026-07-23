"""Análise de conformidade em memória — regras alinhadas à skill site-compliance-audit.

Não grava HTML/relatório em disco. Retorna apenas score, risco e detalhes.
Índice ≈ (conformes / avaliados) × 100  |  críticos forçam risco Crítico.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from config import REQUEST_TIMEOUT

log = logging.getLogger(__name__)
BRT = ZoneInfo("America/Sao_Paulo")


class Area(str, Enum):
    MEDICO = "medico"
    ADVOGADO = "advogado"
    PSICOLOGO = "psicologo"
    FISIO = "fisio"
    DENTISTA = "dentista"
    ACADEMIA = "academia"
    EMPRESA = "empresa"


@dataclass
class CheckItem:
    id: str
    ok: bool
    critico: bool = False
    na: bool = False
    evidencia: str = ""


@dataclass
class ComplianceResult:
    score: int  # 0–100
    risco: str  # Baixo | Médio | Alto | Crítico
    analisado_em: str
    detalhes: dict = field(default_factory=dict)
    area: str = "empresa"
    veredito: str = ""
    erro: str = ""


def _fetch_html(url: str) -> tuple[str, Optional[requests.Response]]:
    try:
        resp = requests.get(
            url,
            timeout=REQUEST_TIMEOUT,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; VeltroComplianceBot/1.1; "
                    "+https://www.veltrodigital.com.br)"
                )
            },
            allow_redirects=True,
        )
        return resp.text, resp
    except requests.RequestException as e:
        log.warning("Falha ao baixar %s: %s", url, e)
        return "", None


def _classify_area(text: str, html: str) -> Area:
    blob = f"{text} {html}".lower()
    if re.search(r"\boab\b|advogad|escrit[oó]rio de advocacia", blob):
        return Area.ADVOGADO
    if re.search(r"\bcrp\b|psic[oó]log", blob):
        return Area.PSICOLOGO
    if re.search(r"\bcrefito\b|fisioterap", blob):
        return Area.FISIO
    if re.search(r"\bcro\b|odontolog|dentista|implante dent", blob):
        return Area.DENTISTA
    if re.search(r"academia|personal trainer|\bcref\b|muscula[cç][aã]o", blob):
        return Area.ACADEMIA
    if re.search(r"\bcrm\b|\brqe\b|m[eé]dic|cl[ií]nica|consult[oó]rio", blob):
        return Area.MEDICO
    return Area.EMPRESA


def _has(pattern: str, *blobs: str, flags: int = re.I) -> bool:
    joined = " ".join(blobs)
    return bool(re.search(pattern, joined, flags))


def _eval_checks(area: Area, text: str, html: str, links: str, resp_url: str, status: int) -> list[CheckItem]:
    items: list[CheckItem] = []
    blob = f"{text} {links}"

    # --- Transversal (todos) ---
    https_ok = urlparse(resp_url).scheme == "https"
    items.append(CheckItem("https", https_ok, critico=not https_ok, evidencia=resp_url))

    items.append(
        CheckItem("http_ok", 200 <= status < 400, evidencia=f"status={status}")
    )

    priv = _has(r"pol[ií]tica de privacidade|prote[cç][aã]o de dados|\blgpd\b", blob)
    items.append(
        CheckItem(
            "politica_privacidade",
            priv,
            critico=not priv,
            evidencia="link/texto privacidade/LGPD" if priv else "ausente",
        )
    )

    cookies = _has(r"cookie|consentimento|aceitar cookies|prefer[eê]ncias de cookies", blob)
    items.append(CheckItem("cookies_banner", cookies, evidencia="banner/consentimento"))

    termos = _has(r"termos? de uso|termos? e condi[cç]", blob)
    items.append(CheckItem("termos_uso", termos))

    contato = _has(r"wa\.me/|whatsapp|mailto:|\(\d{2}\)\s*\d|telefone|contato", html + " " + text)
    items.append(CheckItem("contato", contato, evidencia="telefone/WhatsApp/e-mail"))

    endereco = _has(
        r"rua |av\.|avenida |endere[cç]o|cep\s*\d|shopping |sala \d",
        text,
    )
    items.append(CheckItem("endereco", endereco))

    # Acessibilidade (LBI) — sinais básicos
    has_lang = _has(r'<html[^>]+lang=["\']pt', html) or _has(r"lang=[\"']pt", html)
    items.append(CheckItem("html_lang", has_lang))
    alt_imgs = len(re.findall(r"<img\b", html, re.I))
    alts_ok = alt_imgs == 0 or len(re.findall(r"<img[^>]+alt=", html, re.I)) >= max(1, alt_imgs // 3)
    items.append(CheckItem("img_alt_parcial", alts_ok, evidencia=f"imgs≈{alt_imgs}"))

    # --- Saúde / profissões regulamentadas ---
    is_saude = area in (Area.MEDICO, Area.PSICOLOGO, Area.FISIO, Area.DENTISTA)

    if is_saude:
        # Identificação profissional
        if area == Area.MEDICO:
            reg = _has(r"\bcrm\s*[/\-]?\s*[a-z]{0,2}\s*\d|\bcrm\b.*\d{4,}", text)
            items.append(CheckItem("registro_crm", reg, critico=not reg))
            rqe = _has(r"\brqe\b", text)
            items.append(CheckItem("rqe_se_especialista", rqe))  # atenção se ausente
        elif area == Area.PSICOLOGO:
            reg = _has(r"\bcrp\s*[/\-]?\s*\d|\bcrp\b", text)
            items.append(CheckItem("registro_crp", reg, critico=not reg))
        elif area == Area.FISIO:
            reg = _has(r"\bcrefito\b", text)
            items.append(CheckItem("registro_crefito", reg, critico=not reg))
        elif area == Area.DENTISTA:
            reg = _has(r"\bcro\b", text)
            items.append(CheckItem("registro_cro", reg, critico=not reg))

        # Proibidos CFM / ética saúde — AUSÊNCIA é conforme
        antes_depois = _has(
            r"antes\s*e\s*depois|antes\s*/\s*depois|before\s*and\s*after|resultado do tratamento",
            text + " " + html,
        )
        items.append(
            CheckItem(
                "sem_antes_depois",
                not antes_depois,
                critico=antes_depois,
                evidencia="comparativo detectado" if antes_depois else "ok",
            )
        )

        depoimento = _has(
            r"depoimento|avalia[cç][aã]o de paciente|o que dizem nossos pacientes|"
            r"estrelas?|google reviews|★★|⭐|nossos pacientes dizem",
            text,
        )
        items.append(
            CheckItem(
                "sem_depoimentos",
                not depoimento,
                critico=depoimento,
                evidencia="depoimento/estrelas" if depoimento else "ok",
            )
        )

        promessa = _has(
            r"resultado garantido|cura garantida|100\s*%\s*efic|tratamento definitivo|"
            r"elimine sua dor|sem risco|resultado comprovado",
            text,
        )
        items.append(
            CheckItem(
                "sem_promessas",
                not promessa,
                critico=promessa,
                evidencia="promessa sensacionalista" if promessa else "ok",
            )
        )

        precos = _has(
            r"tabela de pre[cç]os|consulta a partir|r\$\s*\d|valores das consultas|"
            r"pre[cç]o da consulta|pacote promocional",
            text,
        )
        # Preços: crítico para médico/psico/fisio; dentista/academia mais flexível
        critico_preco = area in (Area.MEDICO, Area.PSICOLOGO, Area.FISIO) and precos
        items.append(
            CheckItem(
                "sem_precos_publicos",
                not precos,
                critico=critico_preco,
                evidencia="preços públicos" if precos else "ok",
            )
        )

        contagem = _has(
            r"mais de\s*\d+\.?\d*\s*pacientes|milhares de pacientes|"
            r"\d{3,}\s*procedimentos realizados|\d+\.?\d*\s*atendimentos",
            text,
        )
        items.append(
            CheckItem(
                "sem_contagem_pacientes",
                not contagem,
                critico=contagem,
                evidencia="contagem comercial" if contagem else "ok",
            )
        )

        # LGPD Art. 11 — dados sensíveis de saúde (formulário sem menção a privacidade)
        form = _has(r"<form\b", html)
        if form and not priv:
            items.append(
                CheckItem(
                    "formulario_com_lgpd",
                    False,
                    critico=True,
                    evidencia="formulário sem política de privacidade",
                )
            )
        elif form:
            items.append(CheckItem("formulario_com_lgpd", True, evidencia="form+privacidade"))

    if area == Area.ADVOGADO:
        oab = _has(r"\boab\b", text)
        items.append(CheckItem("registro_oab", oab, critico=not oab))
        captura = _has(
            r"ganhe a causa|resultado garantido|sucesso garantido|honor[aá]rios a partir",
            text,
        )
        items.append(
            CheckItem(
                "sem_captacao_indevida",
                not captura,
                critico=captura,
                evidencia="captação/promessa" if captura else "ok",
            )
        )

    if area == Area.ACADEMIA:
        cref = _has(r"\bcref\b", text)
        items.append(CheckItem("registro_cref_ou_equipe", cref or contato))

    return items


def _score_and_risk(items: list[CheckItem]) -> tuple[int, str, str, dict]:
    avaliados = [i for i in items if not i.na]
    conformes = [i for i in avaliados if i.ok]
    criticos = [i for i in avaliados if i.critico and not i.ok]
    falhas = [i for i in avaliados if not i.ok]

    total = len(avaliados) or 1
    score = int(round(100 * len(conformes) / total))

    # Veredito alinhado à skill
    if score >= 85 and not criticos:
        veredito = "Conforme"
    elif score >= 60 and not criticos:
        veredito = "Aprovado com Ressalvas"
    else:
        veredito = "Não Conforme"

    # Risco comercial para prospecção
    if criticos:
        risco = "Crítico"
    elif score < 40:
        risco = "Crítico"
    elif score < 60:
        risco = "Alto"
    elif score < 80:
        risco = "Médio"
    else:
        risco = "Baixo"

    detalhes = {
        "avaliados": total,
        "conformes": len(conformes),
        "falhas": len(falhas),
        "criticos": len(criticos),
        "itens": {
            i.id: {
                "ok": i.ok,
                "critico": i.critico,
                "evidencia": i.evidencia,
            }
            for i in items
        },
        "falhas_ids": [i.id for i in falhas],
        "criticos_ids": [i.id for i in criticos],
    }
    return score, risco, veredito, detalhes


def analyze_site(url: str) -> ComplianceResult:
    """Audita URL em memória; descarta HTML ao final."""
    agora = datetime.now(BRT).strftime("%Y-%m-%d %H:%M:%S")
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    html, resp = _fetch_html(url)
    if not html or resp is None:
        return ComplianceResult(
            score=0,
            risco="Crítico",
            analisado_em=agora,
            detalhes={"erro": "inacessivel"},
            veredito="Não Conforme",
            erro="Site inacessível",
        )

    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(" ", strip=True)
    links = " ".join(a.get("href", "") for a in soup.find_all("a", href=True))
    area = _classify_area(text, html)
    items = _eval_checks(area, text.lower(), html, links.lower(), resp.url, resp.status_code)
    score, risco, veredito, detalhes = _score_and_risk(items)
    detalhes["area"] = area.value
    detalhes["url_final"] = resp.url

    # Limpar resíduos de memória
    del html, soup, text, links

    return ComplianceResult(
        score=score,
        risco=risco,
        analisado_em=agora,
        detalhes=detalhes,
        area=area.value,
        veredito=veredito,
        erro="",
    )
