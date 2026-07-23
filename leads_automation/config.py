"""Configuração central da automação de prospecção + conformidade."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Rodízio fixo de regiões (ordem do ciclo diário)
REGIOES = ("Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul")

# Estados por região (UF)
ESTADOS_POR_REGIAO: dict[str, list[str]] = {
    "Norte": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
    "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
    "Centro-Oeste": ["DF", "GO", "MT", "MS"],
    "Sudeste": ["ES", "MG", "RJ", "SP"],
    "Sul": ["PR", "RS", "SC"],
}

# Categorias de prospecção
CATEGORIAS = (
    "clínica médica",
    "médico",
    "dentista",
    "psicólogo",
    "terapeuta",
    "advogado",
    "educação física",
    "academia",
    "fisioterapeuta",
)

# Colunas do Excel acumulativo
EXCEL_COLUMNS = [
    "Data da Coleta",
    "Região",
    "Estado",
    "Cidade",
    "Categoria",
    "Nome do Negócio",
    "Website",
    "Telefone",
    "WhatsApp",
    "E-mail",
    "Score de Conformidade",
    "Nível de Risco",
]


def _path(env_key: str, default: str) -> Path:
    raw = os.getenv(env_key, default)
    p = Path(raw)
    return p if p.is_absolute() else BASE_DIR / p


GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()

# Fonte de leads: auto (places → web → demo), web, places, demo
LEAD_SOURCE = os.getenv("LEAD_SOURCE", "auto").strip().lower()
WEB_SEARCH_MAX_PER_QUERY = int(os.getenv("WEB_SEARCH_MAX_PER_QUERY", "8"))
WEB_SEARCH_PAUSE = float(os.getenv("WEB_SEARCH_PAUSE", "0.8"))
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.office365.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER)
EMAIL_TO = os.getenv("EMAIL_TO", "leandro.erikson.oliv@hotmail.com")

EXCEL_PATH = _path("EXCEL_PATH", "data/leads_conformidade_brasil.xlsx")
ROTATION_PATH = _path("ROTATION_PATH", "data/region_rotation.json")
LOG_DIR = _path("LOG_DIR", "logs")

DEFAULT_LIMIT = int(os.getenv("DEFAULT_LIMIT", "20"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "15"))
