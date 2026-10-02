"""Opcional: manda o pacote para o seu Telegram (baixa o vídeo e posta em 1 clique)."""
from __future__ import annotations

import os
from pathlib import Path

import requests


def send_package(folder: Path, caption: str) -> bool:
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not (token and chat):
        return False
    with open(folder / "video.mp4", "rb") as f:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendVideo",
            data={"chat_id": chat, "caption": caption[:1000]},
            files={"video": f},
            timeout=120,
        )
    if not r.ok:
        print(f"  ! Telegram falhou: {r.status_code} {r.text[:120]}")
    return r.ok
