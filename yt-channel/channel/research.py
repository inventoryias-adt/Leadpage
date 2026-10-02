"""Fonte dos fatos: artigo da Wikipédia (o roteiro só pode usar o que está aqui)."""
from __future__ import annotations

import os
import re

import requests

CUT_HEADINGS = ("ver também", "referências", "ligações externas", "notas", "bibliografia",
                "see also", "references", "external links", "notes", "further reading")


def _ua() -> dict:
    return {"User-Agent": f"yt-channel/1.0 ({os.environ.get('WIKI_CONTACT', 'sem-contato')})"}


def clean_text(text: str, max_chars: int) -> str:
    out = []
    for block in re.split(r"\n(?==+ )", text):
        head = block.splitlines()[0].strip("= ").lower() if block.startswith("=") else ""
        if head in CUT_HEADINGS:
            break
        out.append(block)
    text = "\n".join(out)
    if len(text) > max_chars:
        text = text[:max_chars].rsplit("\n", 1)[0]
    return text.strip()


def fetch_article(title: str, lang: str, max_chars: int, http=requests) -> dict:
    api = f"https://{lang}.wikipedia.org/w/api.php"

    def query(t: str) -> dict | None:
        r = http.get(api, headers=_ua(), timeout=30, params={
            "action": "query", "format": "json", "prop": "extracts|info", "inprop": "url",
            "explaintext": 1, "redirects": 1, "titles": t})
        r.raise_for_status()
        page = next(iter(r.json()["query"]["pages"].values()))
        return None if "missing" in page or not page.get("extract") else page

    page = query(title)
    if page is None:  # título não bate: pega o melhor resultado da busca
        r = http.get(api, headers=_ua(), timeout=30, params={
            "action": "query", "format": "json", "list": "search", "srsearch": title, "srlimit": 1})
        r.raise_for_status()
        hits = r.json()["query"]["search"]
        page = query(hits[0]["title"]) if hits else None
    if page is None:
        raise LookupError(f"Artigo não encontrado na Wikipédia: {title}")
    return {"title": page["title"], "url": page["fullurl"], "text": clean_text(page["extract"], max_chars)}
