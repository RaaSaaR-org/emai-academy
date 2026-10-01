#!/usr/bin/env python3
"""EmAI Academy mail relay: re-brands the backend's transactional mails.

The Bootstrap Academy backend compiles its mail templates (subject, layout, footer with the
Bootstrap operator's address) into the binary, and has no setting to change them. Until that
is configurable upstream, the EmAI backend sends to this relay instead of the real SMTP server:

    backend [email] smtp_url = smtp://127.0.0.1:2526  ->  relay  ->  EMAI_MAIL_UPSTREAM (smtp4dev :2525)

For every message the relay
  * maps the subject (known Bootstrap subjects -> EmAI subjects, "Bootstrap Academy" -> brand),
  * re-renders verification and password-reset mails from the tenant templates in
    config/mail/ (the link and code are taken from the original mail),
  * wraps any other mail's content block in the EmAI layout (the Bootstrap footer is dropped),
  * adds a text/plain alternative, and forwards with the original envelope.
If re-branding fails, the original is forwarded unchanged (a lost verification mail is worse
than a Bootstrap-branded one) and the failure is logged.

Python stdlib only (3.9+). Minimal SMTP server: EHLO/HELO, AUTH PLAIN/LOGIN (accepted, local
only), MAIL, RCPT, DATA, RSET, NOOP, QUIT. Listens on 127.0.0.1 (EMAI_MAIL_RELAY_HOST) only.
"""
from __future__ import annotations

import asyncio
import html
import logging
import os
import re
import smtplib
import ssl
import sys
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

HERE = Path(__file__).resolve().parent
TEMPLATES = Path(os.environ.get("EMAI_MAIL_TEMPLATES", HERE.parent.parent / "config" / "mail"))
LISTEN_HOST = os.environ.get("EMAI_MAIL_RELAY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("EMAI_MAIL_RELAY_PORT", "2526"))
UPSTREAM = urlparse(os.environ.get("EMAI_MAIL_UPSTREAM", "smtp://academy:academy@127.0.0.1:2525"))
WEB_URL = os.environ.get("EMAI_WEB_URL", "http://localhost:3001").rstrip("/")
MAX_SIZE = 25 * 1024 * 1024

log = logging.getLogger("mail-relay")

# Upstream subject -> (template, EmAI subject). Unknown subjects only get the brand replaced.
KNOWN = {
    "Willkommen bei der Bootstrap Academy!": ("verify_email", "Willkommen bei der EmAI Academy: Bitte bestätigen Sie Ihre E-Mail-Adresse"),
    "Passwort zurücksetzen - Bootstrap Academy": ("reset_password", "Passwort zurücksetzen | EmAI Academy"),
}
BRAND_REPLACEMENTS = [
    ("Bootstrap-Academy-Team", "Team der EmAI Academy"),
    ("Bootstrap Academy", "EmAI Academy"),
    ("hallo@bootstrap.academy", "info@EmAI.dev"),
    ("https://bootstrap.academy", WEB_URL),
]

URL_RE = re.compile(r'<p style="text-align: center">\s*<a href="([^"]+)">', re.S)
CODE_RE = re.compile(r'font-size: 24px">\s*<b>([^<]+)</b>', re.S)
TITLE_RE = re.compile(r"<h1>(.*?)</h1>", re.S)
CONTENT_RE = re.compile(r"</h1>(.*?)<p>\s*Dein Bootstrap-Academy-Team\s*</p>", re.S)


def render(name: str, **values: str) -> str:
    text = (TEMPLATES / f"{name}.html").read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{ " + key + " }}", value)
    return text


def page(title: str, content_html: str) -> str:
    return render("base", title=html.escape(title), content=content_html, web_url=WEB_URL)


def to_text(markup: str) -> str:
    markup = re.sub(r"(?is)<(style|head)[^>]*>.*?</\1>", "", markup)
    markup = re.sub(r'(?is)<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', lambda m: f"{m.group(2)} ({m.group(1)})" if m.group(1) not in m.group(2) else m.group(2), markup)
    markup = re.sub(r"(?i)<br\s*/?>|</(p|h1|h2|div|tr|li)>", "\n", markup)
    text = html.unescape(re.sub(r"<[^>]+>", "", markup))
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip() + "\n"


def brand(text: str) -> str:
    for old, new in BRAND_REPLACEMENTS:
        text = text.replace(old, new)
    return text


def rebrand(raw: bytes) -> bytes:
    original = BytesParser(policy=policy.default).parsebytes(raw)
    subject = str(original.get("Subject", ""))
    body = original.get_body(preferencelist=("html",))
    source = body.get_content() if body is not None else ""

    template, new_subject = KNOWN.get(subject, (None, brand(subject)))
    content = None
    if template:
        url, code = URL_RE.search(source), CODE_RE.search(source)
        if url and code:
            content = render(template, url=url.group(1), code=html.escape(code.group(1).strip()))
        else:
            log.warning("could not extract link/code from %r; using the generic layout", subject)
    if content is None:
        block = CONTENT_RE.search(source)
        if not block:
            raise ValueError(f"unknown mail layout for subject {subject!r}")
        title = TITLE_RE.search(source)
        heading = brand(html.unescape(re.sub(r"<[^>]+>", "", title.group(1)))) if title else new_subject
        content = f"<h1>{html.escape(heading)}</h1>{brand(block.group(1))}"
    markup = page(new_subject, content)

    msg = EmailMessage()
    for header in ("From", "To", "Cc", "Reply-To", "Date", "Message-ID"):
        if original.get(header):
            msg[header] = original[header]
    msg["Subject"] = new_subject
    msg["X-EmAI-Rebranded"] = template or "generic"
    msg.set_content(to_text(content) + "\n--\n" + to_text(render("footer_text", web_url=WEB_URL)))
    msg.add_alternative(markup, subtype="html")
    # Keep attachments (invoices etc.) as they are.
    for part in original.iter_attachments():
        maintype, subtype = part.get_content_type().split("/", 1)
        msg.add_attachment(part.get_payload(decode=True), maintype=maintype, subtype=subtype, filename=part.get_filename())
    return msg.as_bytes(policy=policy.SMTP)


def forward(mail_from: str, rcpt_to: list[str], data: bytes) -> None:
    # EMAI_MAIL_UPSTREAM URL forms (user and password may be percent-encoded):
    #   smtps://user:pass@host:465                implicit TLS
    #   smtp://user:pass@host:587                 STARTTLS required (submission port)
    #   smtp://...?tls=required  or  ?starttls    STARTTLS required
    #   smtp://host:25                            STARTTLS if the server offers it (smtp4dev doesn't)
    #   smtp://...?tls=none                       never TLS
    query = parse_qs(UPSTREAM.query, keep_blank_values=True)
    tls = query.get("tls", [""])[0]
    host = UPSTREAM.hostname or "127.0.0.1"
    if UPSTREAM.scheme == "smtps":
        smtp = smtplib.SMTP_SSL(host, UPSTREAM.port or 465, timeout=30, context=ssl.create_default_context())
    else:
        smtp = smtplib.SMTP(host, UPSTREAM.port or 25, timeout=30)
    with smtp:
        smtp.ehlo()
        if UPSTREAM.scheme != "smtps" and tls != "none":
            required = tls == "required" or "starttls" in query or UPSTREAM.port == 587
            if required or smtp.has_extn("starttls"):
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
        if UPSTREAM.username:
            try:
                smtp.login(unquote(UPSTREAM.username), unquote(UPSTREAM.password or ""))
            except smtplib.SMTPNotSupportedError:
                pass
        smtp.sendmail(mail_from, rcpt_to, data)


def process(mail_from: str, rcpt_to: list[str], raw: bytes) -> None:
    try:
        data = rebrand(raw)
        log.info("re-branded mail to %s", ", ".join(rcpt_to))
    except Exception:  # noqa: BLE001 - never drop a mail because re-branding failed
        log.exception("re-branding failed; forwarding the original")
        data = raw
    forward(mail_from, rcpt_to, data)


class Session:
    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self.reader, self.writer = reader, writer
        self.reset()

    def reset(self) -> None:
        self.mail_from: str | None = None
        self.rcpt_to: list[str] = []

    async def send(self, line: str) -> None:
        self.writer.write((line + "\r\n").encode())
        await self.writer.drain()

    async def readline(self) -> bytes:
        return await self.reader.readline()

    async def run(self) -> None:
        await self.send("220 emai-mail-relay ESMTP")
        while True:
            line = await self.readline()
            if not line:
                return
            cmd = line.decode("utf-8", "replace").rstrip("\r\n")
            verb, _, arg = cmd.partition(" ")
            verb = verb.upper()
            if verb == "EHLO":
                await self.send("250-emai-mail-relay")
                await self.send(f"250-SIZE {MAX_SIZE}")
                await self.send("250-8BITMIME")
                await self.send("250-SMTPUTF8")
                await self.send("250 AUTH PLAIN LOGIN")
            elif verb == "HELO":
                await self.send("250 emai-mail-relay")
            elif verb == "AUTH":
                # Local dev relay: any credentials are accepted (it only listens on 127.0.0.1).
                mech = arg.split(" ")[0].upper()
                if mech == "LOGIN":
                    await self.send("334 VXNlcm5hbWU6")
                    await self.readline()
                    await self.send("334 UGFzc3dvcmQ6")
                    await self.readline()
                elif mech == "PLAIN" and " " not in arg:
                    await self.send("334 ")
                    await self.readline()
                await self.send("235 2.7.0 Authentication successful")
            elif verb == "MAIL":
                m = re.search(r"FROM:\s*<([^>]*)>", arg, re.I)
                self.reset()
                self.mail_from = m.group(1) if m else ""
                await self.send("250 OK")
            elif verb == "RCPT":
                m = re.search(r"TO:\s*<([^>]*)>", arg, re.I)
                if self.mail_from is None or not m:
                    await self.send("503 need MAIL before RCPT")
                else:
                    self.rcpt_to.append(m.group(1))
                    await self.send("250 OK")
            elif verb == "DATA":
                if not self.rcpt_to:
                    await self.send("503 need RCPT before DATA")
                    continue
                await self.send("354 End data with <CR><LF>.<CR><LF>")
                chunks = []
                while True:
                    chunk = await self.readline()
                    if not chunk or chunk in (b".\r\n", b".\n"):
                        break
                    chunks.append(chunk[1:] if chunk.startswith(b"..") else chunk)
                raw = b"".join(chunks)
                try:
                    await asyncio.get_running_loop().run_in_executor(None, process, self.mail_from or "", list(self.rcpt_to), raw)
                    await self.send("250 OK queued")
                except Exception as exc:  # noqa: BLE001
                    log.exception("forwarding failed")
                    await self.send(f"451 4.3.0 upstream SMTP failed: {exc.__class__.__name__}")
                self.reset()
            elif verb == "RSET":
                self.reset()
                await self.send("250 OK")
            elif verb == "NOOP":
                await self.send("250 OK")
            elif verb == "QUIT":
                await self.send("221 Bye")
                self.writer.close()
                return
            else:
                await self.send("502 Command not implemented")


async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        await Session(reader, writer).run()
    except (ConnectionError, asyncio.IncompleteReadError):
        pass
    finally:
        if not writer.is_closing():
            writer.close()


async def main() -> None:
    server = await asyncio.start_server(handle, LISTEN_HOST, LISTEN_PORT, limit=MAX_SIZE)
    log.info("listening on %s:%s, forwarding to %s:%s, templates %s", LISTEN_HOST, LISTEN_PORT, UPSTREAM.hostname, UPSTREAM.port, TEMPLATES)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", stream=sys.stdout)
    if len(sys.argv) == 2 and sys.argv[1] != "serve":
        # Preview: relay.py <raw .eml> -> prints the re-branded message
        sys.stdout.buffer.write(rebrand(Path(sys.argv[1]).read_bytes()))
    else:
        asyncio.run(main())
