"""Envio de e-mail via SMTP do Google Workspace (Gmail smtp.gmail.com, STARTTLS).

Credenciais via ambiente (não commitar valores reais):
  GOOGLE_SMTP_USER, GOOGLE_SMTP_PASSWORD (senha de app)
Opcionais: GOOGLE_SMTP_HOST (default smtp.gmail.com), GOOGLE_SMTP_PORT (587),
           GOOGLE_SMTP_FROM (default = GOOGLE_SMTP_USER)
"""
from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional, Tuple


def google_smtp_config_from_env():
    """Retorna dict com host, port, user, password, from_addr ou None se incompleto."""
    user = (os.environ.get('GOOGLE_SMTP_USER') or '').strip()
    password = (os.environ.get('GOOGLE_SMTP_PASSWORD') or '').strip()
    if not user or not password:
        return None
    host = (os.environ.get('GOOGLE_SMTP_HOST') or 'smtp.gmail.com').strip()
    port_raw = (os.environ.get('GOOGLE_SMTP_PORT') or '587').strip()
    try:
        port = int(port_raw)
    except ValueError:
        port = 587
    from_addr = (os.environ.get('GOOGLE_SMTP_FROM') or user).strip()
    return {'host': host, 'port': port, 'user': user, 'password': password, 'from_addr': from_addr}


def send_google_workspace_email(
    to_addrs: List[str],
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """Envia um e-mail HTML (com parte texto opcional). Retorna (ok, erro_ou_None)."""
    cfg = google_smtp_config_from_env()
    if not cfg:
        return False, 'SMTP Google nao configurado (defina GOOGLE_SMTP_USER e GOOGLE_SMTP_PASSWORD).'

    recipients = [a.strip() for a in to_addrs if (a or '').strip()]
    if not recipients:
        return False, 'Nenhum destinatario.'

    subj = (subject or '').strip() or '(sem assunto)'
    html = html_body or ''
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subj
    msg['From'] = cfg['from_addr']
    msg['To'] = ', '.join(recipients)

    if text_body:
        msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
    msg.attach(MIMEText(html, 'html', 'utf-8'))

    try:
        server = smtplib.SMTP(cfg['host'], cfg['port'], timeout=60)
        try:
            server.starttls()
            server.login(cfg['user'], cfg['password'])
            server.sendmail(cfg['from_addr'], recipients, msg.as_string())
        finally:
            try:
                server.quit()
            except Exception:
                pass
    except Exception as exc:
        return False, str(exc)
    return True, None
