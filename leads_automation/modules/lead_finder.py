"""Busca de leads por região (Places API ou modo demo)."""

from __future__ import annotations

import logging
import re
from dataclasses import asdict, dataclass, field
from typing import Optional
from urllib.parse import urlparse

import requests

from config import (
    CATEGORIAS,
    ESTADOS_POR_REGIAO,
    GOOGLE_PLACES_API_KEY,
    REQUEST_TIMEOUT,
)

log = logging.getLogger(__name__)

# Cidades âncora por UF (para queries Places / demo)
CIDADES_ANCORA: dict[str, list[str]] = {
    "AC": ["Rio Branco"],
    "AP": ["Macapá"],
    "AM": ["Manaus"],
    "PA": ["Belém"],
    "RO": ["Porto Velho"],
    "RR": ["Boa Vista"],
    "TO": ["Palmas"],
    "AL": ["Maceió"],
    "BA": ["Salvador"],
    "CE": ["Fortaleza"],
    "MA": ["São Luís"],
    "PB": ["João Pessoa"],
    "PE": ["Recife"],
    "PI": ["Teresina"],
    "RN": ["Natal"],
    "SE": ["Aracaju"],
    "DF": ["Brasília"],
    "GO": ["Goiânia"],
    "MT": ["Cuiabá"],
    "MS": ["Campo Grande"],
    "ES": ["Vitória"],
    "MG": ["Belo Horizonte"],
    "RJ": ["Rio de Janeiro", "Volta Redonda", "Resende"],
    "SP": ["São Paulo", "Campinas", "Sorocaba", "Jundiaí"],
    "PR": ["Curitiba"],
    "RS": ["Porto Alegre"],
    "SC": ["Florianópolis"],
}


@dataclass
class Lead:
    nome: str
    categoria: str
    website: str
    telefone: str = ""
    whatsapp: str = ""
    email: str = ""
    cidade: str = ""
    estado: str = ""
    regiao: str = ""
    fonte: str = ""
    observacao: str = ""
    extras: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if not url.startswith("http"):
        url = "https://" + url
    parsed = urlparse(url)
    if not parsed.netloc:
        return ""
    # Domínio canônico sem path para dedupe futuro
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


def _is_marketplace(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    blocked = (
        "doctoralia.com.br",
        "facebook.com",
        "instagram.com",
        "linkedin.com",
        "google.com",
        "guiafacil.com",
        "telelistas.net",
    )
    return any(b in host for b in blocked)


def _extract_wa_from_site(url: str) -> str:
    """Tentativa rápida de extrair WhatsApp do HTML do site."""
    try:
        resp = requests.get(
            url,
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": "VeltroLeadsBot/1.0 (+https://www.veltrodigital.com.br)"},
            allow_redirects=True,
        )
        html = resp.text
    except requests.RequestException:
        return ""

    for pat in (
        r"https?://(?:api\.)?whatsapp\.com/send\?[^\"'\s>]*phone=(\d+)",
        r"https?://wa\.me/(\d+)",
    ):
        m = re.search(pat, html, re.I)
        if m:
            digits = re.sub(r"\D", "", m.group(1))
            if not digits.startswith("55") and len(digits) in (10, 11):
                digits = "55" + digits
            if len(digits) in (12, 13):
                return digits
    return ""


def _search_places(query: str, cidade: str, estado: str) -> list[dict]:
    """Text Search + Place Details (website, phone)."""
    if not GOOGLE_PLACES_API_KEY:
        return []

    text_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    details_url = "https://maps.googleapis.com/maps/api/place/details/json"
    results: list[dict] = []

    try:
        r = requests.get(
            text_url,
            params={
                "query": f"{query} {cidade} {estado} Brasil",
                "key": GOOGLE_PLACES_API_KEY,
                "language": "pt-BR",
                "region": "br",
            },
            timeout=REQUEST_TIMEOUT,
        )
        r.raise_for_status()
        data = r.json()
    except requests.RequestException as e:
        log.warning("Places TextSearch falhou: %s", e)
        return []

    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        log.warning("Places status=%s | %s", data.get("status"), data.get("error_message"))
        return []

    for item in data.get("results", [])[:8]:
        place_id = item.get("place_id")
        if not place_id:
            continue
        try:
            d = requests.get(
                details_url,
                params={
                    "place_id": place_id,
                    "fields": "name,formatted_phone_number,international_phone_number,website,formatted_address",
                    "key": GOOGLE_PLACES_API_KEY,
                    "language": "pt-BR",
                },
                timeout=REQUEST_TIMEOUT,
            )
            d.raise_for_status()
            result = d.json().get("result", {})
        except requests.RequestException:
            continue

        website = _normalize_url(result.get("website", ""))
        if not website or _is_marketplace(website):
            continue

        phone = result.get("international_phone_number") or result.get("formatted_phone_number") or ""
        results.append(
            {
                "nome": result.get("name") or item.get("name", ""),
                "website": website,
                "telefone": phone,
                "cidade": cidade,
                "estado": estado,
                "endereco": result.get("formatted_address", ""),
            }
        )
    return results


def _demo_leads(regiao: str, limit: int) -> list[Lead]:
    """Leads reais públicos para teste sem Places API (sites próprios)."""
    ufs = ESTADOS_POR_REGIAO.get(regiao, ["SP"])
    catalog = [
        ("Prime Care Medical Complex", "clínica médica", "https://www.primecare.med.br/", "São Paulo", "SP"),
        ("Doctor Center Med", "clínica médica", "https://doctorcentermed.com/", "São Paulo", "SP"),
        ("Clínica Cordis", "médico", "https://clinicacordis.com.br/", "Volta Redonda", "RJ"),
        ("Gastroclínica Volta Redonda", "clínica médica", "https://gastroclinicavoltaredonda.com.br/", "Volta Redonda", "RJ"),
        ("Atend Já Volta Redonda", "clínica médica", "https://voltaredonda.atendja.com.br/", "Volta Redonda", "RJ"),
        ("Tiago Silveira Dermatologia", "médico", "https://tiagosilveira.med.br/", "Rio de Janeiro", "RJ"),
        ("Drummond Dermato", "médico", "https://drummondermato.com/", "Rio de Janeiro", "RJ"),
        ("Pró Clínica Sorocaba", "clínica médica", "https://proclinicasorocaba.com.br/", "Sorocaba", "SP"),
        ("Clínica Simoneti", "clínica médica", "https://clinicasimoneti.com.br/", "Sorocaba", "SP"),
        ("Clínica Rubi", "clínica médica", "https://www.clinicarubi.com.br/", "Jundiaí", "SP"),
        ("Smile Clínica Odontológica", "dentista", "https://smilebh.com.br/", "Belo Horizonte", "MG"),
        ("ClinBelo", "dentista", "https://clinbelo.com.br/", "Belo Horizonte", "MG"),
    ]
    out: list[Lead] = []
    for nome, cat, url, cidade, uf in catalog:
        if len(out) >= limit:
            break
        if uf not in ufs and regiao == "Sudeste":
            pass  # SP/RJ/MG ok no Sudeste
        elif uf not in ufs:
            uf = ufs[0]
            cidade = CIDADES_ANCORA.get(uf, [cidade])[0]
        out.append(
            Lead(
                nome=nome,
                categoria=cat,
                website=url,
                cidade=cidade,
                estado=uf,
                regiao=regiao,
                fonte="demo_sites_reais",
                observacao="Sem GOOGLE_PLACES_API_KEY — catálogo demo de sites públicos",
            )
        )
    return out


def find_leads(
    regiao: str,
    limit: int = 20,
    categorias: Optional[tuple[str, ...]] = None,
    extract_whatsapp: bool = True,
) -> list[Lead]:
    """
    Busca leads com site próprio na região.
    Sem GOOGLE_PLACES_API_KEY: retorna leads demo.
    """
    categorias = categorias or CATEGORIAS
    ufs = ESTADOS_POR_REGIAO.get(regiao)
    if not ufs:
        raise ValueError(f"Região inválida: {regiao}")

    if not GOOGLE_PLACES_API_KEY:
        log.warning("GOOGLE_PLACES_API_KEY ausente — usando leads demo")
        return _demo_leads(regiao, limit)

    seen_domains: set[str] = set()
    leads: list[Lead] = []

    for uf in ufs:
        if len(leads) >= limit:
            break
        cidades = CIDADES_ANCORA.get(uf, [uf])
        for cidade in cidades:
            if len(leads) >= limit:
                break
            for cat in categorias:
                if len(leads) >= limit:
                    break
                raw = _search_places(cat, cidade, uf)
                for item in raw:
                    if len(leads) >= limit:
                        break
                    website = item["website"]
                    domain = urlparse(website).netloc.lower()
                    if domain in seen_domains:
                        continue
                    seen_domains.add(domain)

                    wa = ""
                    if extract_whatsapp:
                        wa = _extract_wa_from_site(website)

                    leads.append(
                        Lead(
                            nome=item["nome"],
                            categoria=cat,
                            website=website,
                            telefone=item.get("telefone", ""),
                            whatsapp=wa,
                            cidade=item.get("cidade", cidade),
                            estado=uf,
                            regiao=regiao,
                            fonte="google_places",
                        )
                    )
                    log.info("Lead: %s | %s", item["nome"], website)

    log.info("Total leads encontrados: %s (região=%s)", len(leads), regiao)
    return leads
