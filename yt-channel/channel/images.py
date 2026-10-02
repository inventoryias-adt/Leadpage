"""Imagem de cada cena: 1) Wikimedia Commons (licença livre) 2) IA (MuAPI) 3) cartão de cor."""
from __future__ import annotations

import html
import io
import os
import re
from pathlib import Path

import requests
from PIL import Image, ImageDraw

from . import muapi
from .research import _ua

COMMONS = "https://commons.wikimedia.org/w/api.php"
BAD_LICENSE = ("-nc", "-nd", "fair use", "non-free", "all rights")


def license_ok(name: str, allowed: list[str]) -> bool:
    n = (name or "").lower().replace("_", " ")
    if not n or any(b in n for b in BAD_LICENSE):
        return False
    if "-sa" in n:
        return "cc by-sa" in allowed
    return any(n.startswith(a) or a in n for a in allowed)


def _strip(htm: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", htm or "")).strip()


def commons_search(query: str, cfg: dict, used: set[str], http=requests) -> dict | None:
    icfg = cfg["images"]
    r = http.get(COMMONS, headers=_ua(), timeout=30, params={
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
        "gsrsearch": f"{query} filetype:bitmap", "gsrlimit": 15, "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata", "iiurlwidth": cfg["video"]["width"]})
    r.raise_for_status()
    pages = (r.json().get("query") or {}).get("pages", {})
    for page in sorted(pages.values(), key=lambda p: p.get("index", 0)):
        info = (page.get("imageinfo") or [None])[0]
        if not info or info["mime"] not in ("image/jpeg", "image/png"):
            continue
        if info["width"] < icfg["min_width"] or info["height"] < 500 or page["title"] in used:
            continue
        meta = info.get("extmetadata", {})
        lic = (meta.get("LicenseShortName") or {}).get("value", "")
        if not license_ok(lic, icfg["allowed_licenses"]):
            continue
        return {
            "title": page["title"], "url": info.get("thumburl") or info["url"],
            "author": _strip((meta.get("Artist") or {}).get("value", "")) or "autor desconhecido",
            "license": lic, "page": info.get("descriptionurl", ""),
        }
    return None


def _save(img: Image.Image, path: Path) -> Path:
    img.convert("RGB").save(path, quality=92)
    return path


def card(text: str, w: int, h: int, path: Path, idx: int = 0) -> Path:
    colors = [(30, 40, 70), (60, 35, 35), (30, 55, 50), (50, 40, 70)]
    img = Image.new("RGB", (w, h), colors[idx % len(colors)])
    d = ImageDraw.Draw(img)
    for y in range(h):  # degradê vertical
        d.line((0, y, w, y), fill=tuple(int(c * (1 - 0.5 * y / h)) for c in colors[idx % len(colors)]))
    return _save(img, path)


def scene_image(scene: dict, idx: int, cfg: dict, workdir: Path, used: set[str],
                ai_client: muapi.MuapiClient | None, http=requests) -> dict:
    path = workdir / f"img_{idx:03d}.jpg"
    w, h = cfg["video"]["width"], cfg["video"]["height"]
    try:
        hit = commons_search(scene["commons_query"], cfg, used, http)
        if hit:
            r = http.get(hit["url"], headers=_ua(), timeout=60)
            r.raise_for_status()
            _save(Image.open(io.BytesIO(r.content)), path)
            used.add(hit["title"])
            credit = f"{hit['title'].removeprefix('File:')} — {hit['author']} ({hit['license']}) {hit['page']}"
            return {"path": path, "kind": "commons", "credit": credit}
    except Exception as e:
        print(f"  ! Commons falhou na cena {idx} ({e})")
    if cfg["images"]["ai_fallback"] and (ai_client or os.environ.get("MUAPI_API_KEY")):
        try:
            client = ai_client or muapi.MuapiClient()
            client.text_to_image(f"{scene['ai_prompt']}, {cfg['images']['ai_style']}", cfg["images"]["ai_model"], path)
            _save(Image.open(path), path)
            return {"path": path, "kind": "ai", "credit": None}
        except Exception as e:
            print(f"  ! IA falhou na cena {idx} ({e})")
    card(scene.get("chapter") or "", w, h, path, idx)
    return {"path": path, "kind": "card", "credit": None}
