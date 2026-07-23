"""Busca gratuita na web via DuckDuckGo — sem API key paga."""

from __future__ import annotations

import logging
import re
import time
from typing import Optional
from urllib.parse import urlparse

log = logging.getLogger(__name__)

# Diretórios/redes sociais — não são site próprio do negócio
BLOCKED_HOSTS = (
    "doctoralia.com.br",
    "doctoralia.com",
    "facebook.com",
    "fb.com",
    "instagram.com",
    "linkedin.com",
    "google.com",
    "google.com.br",
    "guiafacil.com",
    "telelistas.net",
    "booking.com",
    "tripadvisor.",
    "youtube.com",
    "wikipedia.org",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "mercadolivre.com.br",
    "olx.com.br",
    "getninjas.com.br",
    "paginasamarelas.com.br",
    "apontador.com.br",
    "infoisinfo.com.br",
    "eguias.net",
    "agenda.app.br",
    "agendaconvenio.com",
    "benditoguia.com.br",
    "top-rated.online",
    "yelp.",
    "reddit.com",
    "gov.br",
    "jusbrasil.com.br",
)

# TLDs genéricos de plataforma (não site próprio)
BLOCKED_SUFFIXES = (
    ".wordpress.com",
    ".blogspot.com",
    ".wixsite.com",
    ".squarespace.com",
    ".weebly.com",
)


def _ddgs_client():
    try:
        from ddgs import DDGS

        return DDGS()
    except ImportError:
        from duckduckgo_search import DDGS  # noqa: PLC0415 — fallback legado

        return DDGS()


def is_blocked_url(url: str) -> bool:
    host = urlparse(url if url.startswith("http") else f"https://{url}").netloc.lower()
    host = host.removeprefix("www.")
    if any(b in host for b in BLOCKED_HOSTS):
        return True
    return any(host.endswith(s) for s in BLOCKED_SUFFIXES)


def clean_business_name(title: str, url: str = "") -> str:
    """Extrai nome legível a partir do título do resultado de busca."""
    name = (title or "").strip()
    if not name:
        if url:
            host = urlparse(url).netloc.replace("www.", "")
            return host.split(".")[0].replace("-", " ").title()
        return "Negócio"

    # Corta sufixos comuns de SERP
    for sep in (" | ", " - ", " – ", " — ", " :: "):
        if sep in name:
            parts = [p.strip() for p in name.split(sep) if p.strip()]
            # Prefere parte que não seja genérica
            generic = {"home", "início", "pagina inicial", "página inicial", "site oficial"}
            chosen = next((p for p in parts if p.lower() not in generic), parts[0])
            name = chosen
            break

    name = re.sub(r"\s+", " ", name).strip()
    return name[:120] if name else "Negócio"


def search_web(
    query: str,
    max_results: int = 8,
    region: str = "br-pt",
    pause_seconds: float = 0.8,
) -> list[dict]:
    """
    Busca na web via DuckDuckGo.
    Retorna dicts: {nome, website, snippet, fonte}.
    """
    if pause_seconds > 0:
        time.sleep(pause_seconds)

    try:
        raw = _ddgs_client().text(query, max_results=max_results, region=region)
        items = list(raw) if raw is not None else []
    except Exception as e:  # noqa: BLE001 — resiliência por query
        log.warning("DuckDuckGo falhou para %r: %s", query, e)
        return []

    out: list[dict] = []
    for item in items:
        href = (item.get("href") or item.get("url") or "").strip()
        if not href.startswith("http"):
            continue
        if is_blocked_url(href):
            continue

        parsed = urlparse(href)
        if not parsed.netloc:
            continue

        website = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        title = item.get("title") or item.get("body") or ""
        out.append(
            {
                "nome": clean_business_name(title, website),
                "website": website,
                "snippet": (item.get("body") or "")[:300],
                "fonte": "duckduckgo_web",
            }
        )

    log.debug("Web search %r → %s resultados úteis", query, len(out))
    return out


def build_query(categoria: str, cidade: str, estado: str) -> str:
    """Monta query focada em site próprio na região."""
    cat = categoria.strip()
    return (
        f'{cat} {cidade} {estado} Brasil site '
        f"-doctoralia -facebook -instagram -telelistas -booking"
    )
