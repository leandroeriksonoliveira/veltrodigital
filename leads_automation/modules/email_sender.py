"""Envio de relatório diário por e-mail (SMTP)."""

from __future__ import annotations

import logging
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from config import (
    EMAIL_FROM,
    EMAIL_TO,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)

log = logging.getLogger(__name__)


EMAIL_TEMPLATE = """\
Olá,

Segue o relatório diário de prospecção e conformidade — Veltro Digital.

Resumo do dia
-------------
Região analisada: {regiao}
Leads capturados (novos na planilha): {novos}
Leads analisados neste ciclo: {analisados}
Sites com risco Alto: {alto}
Sites com risco Crítico: {critico}
Duplicados ignorados: {duplicados}

O arquivo Excel acumulativo está em anexo.

—
Automação Veltro Digital · Conformidade
"""


def build_body(
    regiao: str,
    novos: int,
    analisados: int,
    alto: int,
    critico: int,
    duplicados: int = 0,
) -> str:
    return EMAIL_TEMPLATE.format(
        regiao=regiao,
        novos=novos,
        analisados=analisados,
        alto=alto,
        critico=critico,
        duplicados=duplicados,
    )


def send_report(
    subject: str,
    body: str,
    attachment: Path | None = None,
    dry_run: bool = False,
) -> bool:
    if dry_run:
        log.info("[dry-run] E-mail NÃO enviado | assunto=%s | para=%s", subject, EMAIL_TO)
        log.debug("Corpo:\n%s", body)
        return True

    if not SMTP_USER or not SMTP_PASSWORD:
        log.error("SMTP_USER/SMTP_PASSWORD ausentes no .env — e-mail não enviado")
        return False

    msg = MIMEMultipart()
    msg["From"] = EMAIL_FROM or SMTP_USER
    msg["To"] = EMAIL_TO
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    if attachment and attachment.exists():
        with attachment.open("rb") as f:
            part = MIMEApplication(f.read(), Name=attachment.name)
        part["Content-Disposition"] = f'attachment; filename="{attachment.name}"'
        msg.attach(part)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        log.info("E-mail enviado para %s", EMAIL_TO)
        return True
    except smtplib.SMTPException as e:
        log.error("Falha SMTP: %s", e)
        return False
