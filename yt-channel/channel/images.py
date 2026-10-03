"""Imagem de cada cena.

Ordem: 1) acervo do tema (imagens do artigo da Wikipédia + buscas gerais no Commons), escolhidas por afinidade com a
narração; 2) busca no Commons com consultas cada vez mais gerais; 3) IA (MuAPI, opcional); 4) reaproveitar a imagem real
MENOS usada; 5) cartão de cor."""
from __future__ import annotations

import html
import io
import os
import re
import shutil
import time
import unicodedata
from pathlib import Path

import requests
from PIL import Image, ImageDraw

from . import muapi
from .research import _ua

COMMONS = "https://commons.wikimedia.org/w/api.php"
MIN_GAP = 1.2          # segundos entre chamadas à Wikimedia (limite de taxa)
_last_call = [0.0]
BAD_LICENSE = ("-nc", "-nd", "fair use", "non-free", "all rights")


def polite_get(http, url, **kw):
    """GET com intervalo mínimo e novas tentativas em 429 (respeita Retry-After)."""
    r = None
    for attempt in range(4):
        wait = MIN_GAP - (time.monotonic() - _last_call[0])
        if wait > 0:
            time.sleep(wait)
        r = http.get(url, **kw)
        _last_call[0] = time.monotonic()
        if getattr(r, "status_code", 200) != 429:
            return r
        try:
            retry = float(r.headers.get("Retry-After", 0))
        except (TypeError, ValueError):
            retry = 0
        time.sleep(min(retry or 5 * (attempt + 1), 45))
    return r


def license_ok(name: str, allowed: list[str]) -> bool:
    n = (name or "").lower().replace("_", " ")
    if not n or any(b in n for b in BAD_LICENSE):
        return False
    if "-sa" in n:
        return "cc by-sa" in allowed
    return any(n.startswith(a) or a in n for a in allowed)


def _strip(htm: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", htm or "")).strip()


STOP = set("""the and for with from that this was were are his her their its into over under between about after before
of in on at to by an as de da do das dos que com para por uma uns umas num numa sua suas seu seus nos nas aos pelo pela
como mais foi era são ser ter tem mas não sem sobre entre depois antes quando também""".split())
BAD_WORDS = {"flag", "icon", "logo", "ambox", "question", "symbol", "stub", "button", "pin"}


def tokens(text: str) -> set[str]:
    t = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    return {w for w in re.findall(r"[a-z0-9]{3,}", t) if w not in STOP}


def fallback_queries(query: str) -> list[str]:
    """Consulta completa, depois versões mais curtas (3 e 2 palavras): buscas longas demais não acham nada."""
    words = query.split()
    out = [query]
    for n in (3, 2):
        if len(words) > n:
            out.append(" ".join(words[:n]))
    return list(dict.fromkeys(out))


def _candidate(page: dict, cfg: dict, stats: dict) -> dict | None:
    """Aceita só JPG/PNG grandes com licença permitida; conta por que descartou (para você decidir a política)."""
    icfg = cfg["images"]
    info = (page.get("imageinfo") or [None])[0]
    if not info or info.get("mime") not in ("image/jpeg", "image/png"):
        return None
    title = page.get("title", "")
    if set(re.findall(r"[a-z]+", title.lower())) & BAD_WORDS:
        return None
    if info["width"] < icfg["min_width"] or info["height"] < 500:
        stats["pequena"] = stats.get("pequena", 0) + 1
        return None
    meta = info.get("extmetadata", {})
    lic = (meta.get("LicenseShortName") or {}).get("value", "")
    if not license_ok(lic, icfg["allowed_licenses"]):
        low = lic.lower()
        key = "licenca_sa" if "-sa" in low else "licenca_nc_nd" if ("-nc" in low or "-nd" in low) else "licenca_outra"
        stats[key] = stats.get(key, 0) + 1
        return None
    desc = " ".join(_strip((meta.get(k) or {}).get("value", "")) for k in ("ObjectName", "ImageDescription", "Categories"))
    return {
        "title": title, "url": info.get("thumburl") or info["url"],
        "author": _strip((meta.get("Artist") or {}).get("value", "")) or "autor desconhecido",
        "license": lic, "page": info.get("descriptionurl", ""),
        "tokens": tokens(f"{title} {desc}"),
    }


def _pages(http, params: dict) -> list[dict]:
    r = polite_get(http, COMMONS, headers=_ua(), timeout=30, params={"action": "query", "format": "json", **params})
    r.raise_for_status()
    pages = (r.json().get("query") or {}).get("pages", {})
    return sorted(pages.values(), key=lambda p: p.get("index", 0))


def search_candidates(query: str, cfg: dict, http=requests, stats: dict | None = None, limit: int = 30) -> list[dict]:
    pages = _pages(http, {
        "generator": "search", "gsrnamespace": 6, "gsrsearch": f"{query} filetype:bitmap", "gsrlimit": limit,
        "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": cfg["video"]["width"]})
    st = stats if stats is not None else {}
    return [c for c in (_candidate(p, cfg, st) for p in pages) if c]


def commons_search(query: str, cfg: dict, used: set[str], http=requests) -> dict | None:
    """Primeira imagem livre ainda não usada para a consulta."""
    for c in search_candidates(query, cfg, http, limit=15):
        if c["title"] not in used:
            return c
    return None


def lookup_titles(titles: list[str], cfg: dict, http=requests, stats: dict | None = None) -> list[dict]:
    st = stats if stats is not None else {}
    out = []
    for i in range(0, len(titles), 40):
        pages = _pages(http, {"titles": "|".join(titles[i:i + 40]), "prop": "imageinfo",
                              "iiprop": "url|size|mime|extmetadata", "iiurlwidth": cfg["video"]["width"]})
        out += [c for c in (_candidate(p, cfg, st) for p in pages) if c]
    return out


def article_image_titles(lang: str, title: str, http=requests) -> list[str]:
    """Imagens usadas no artigo da Wikipédia (o prefixo do namespace é localizado: normaliza para 'File:')."""
    r = polite_get(http, f"https://{lang}.wikipedia.org/w/api.php", headers=_ua(), timeout=30, params={
        "action": "query", "format": "json", "prop": "images", "imlimit": "max", "titles": title, "redirects": 1})
    r.raise_for_status()
    out = []
    for page in (r.json().get("query") or {}).get("pages", {}).values():
        for im in page.get("images", []):
            name = im["title"].split(":", 1)[-1]
            if name.lower().endswith((".jpg", ".jpeg", ".png")):
                out.append(f"File:{name}")
    return out


def langlink(lang: str, title: str, target: str, http=requests) -> str | None:
    r = polite_get(http, f"https://{lang}.wikipedia.org/w/api.php", headers=_ua(), timeout=30, params={
        "action": "query", "format": "json", "prop": "langlinks", "lllang": target, "titles": title, "redirects": 1})
    r.raise_for_status()
    for page in (r.json().get("query") or {}).get("pages", {}).values():
        for ll in page.get("langlinks", []):
            return ll.get("*") or ll.get("title")
    return None


def build_pool(wiki_title: str, topic_title: str, cfg: dict, http=requests) -> tuple[list[dict], dict]:
    """Acervo do tema: imagens do artigo (pt e en) + buscas gerais no Commons. Tudo já filtrado por licença/tamanho."""
    stats: dict = {}
    pool: dict[str, dict] = {}
    lang = cfg["wikipedia_lang"]

    def add(cands: list[dict]) -> None:
        for c in cands:
            pool.setdefault(c["title"], c)

    en_title = None
    try:
        en_title = langlink(lang, wiki_title, "en", http)
    except Exception as e:
        print(f"  ! título em inglês indisponível ({str(e)[:70]})")
    for lg, ttl in ((lang, wiki_title), ("en", en_title)):
        if not ttl:
            continue
        try:
            titles = article_image_titles(lg, ttl, http)
            add(lookup_titles(titles, cfg, http, stats))
        except Exception as e:
            print(f"  ! imagens do artigo {lg}:{ttl} indisponíveis ({str(e)[:70]})")
    for q in dict.fromkeys(x for x in (topic_title, wiki_title, en_title) if x):
        try:
            add(search_candidates(q, cfg, http, stats, limit=30))
        except Exception as e:
            print(f"  ! busca geral '{q}' falhou ({str(e)[:70]})")
    stats["acervo"] = len(pool)
    return list(pool.values()), stats


def pick_candidate(cands: list[dict], used: set[str], q_tokens: set[str], n_tokens: set[str], min_score: int) -> dict | None:
    """Imagem ainda não usada com mais afinidade: palavras da consulta pesam 2, as da narração pesam 1."""
    best, best_score = None, -1
    for c in cands:
        if c["title"] in used:
            continue
        score = 2 * len(q_tokens & c["tokens"]) + len(n_tokens & c["tokens"])
        if score > best_score:
            best, best_score = c, score
    return best if best is not None and best_score >= min_score else None


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


def _download(cand: dict, path: Path, http) -> bool:
    try:
        r = polite_get(http, cand["url"], headers=_ua(), timeout=60)
        r.raise_for_status()
        _save(Image.open(io.BytesIO(r.content)), path)
        return True
    except Exception as e:
        print(f"  ! download falhou ({cand['title'][:40]}: {str(e)[:60]})")
        return False


def _real(cand: dict, path: Path, kind: str, how: str, ctx: dict, idx: int) -> dict:
    ctx["used"].add(cand["title"])
    credit = f"{cand['title'].removeprefix('File:')} — {cand['author']} ({cand['license']}) {cand['page']}"
    info = {"path": path, "kind": kind, "credit": credit, "how": how}
    ctx["pool"].append(info)
    ctx["uses"][str(path)] = 1
    ctx["last"][str(path)] = idx
    return info


def scene_image(scene: dict, idx: int, cfg: dict, workdir: Path, ctx: dict,
                ai_client: muapi.MuapiClient | None, http=requests) -> dict:
    """ctx: {"used": set de títulos, "pool": imagens reais já obtidas, "ai_ok": bool, "candidates": acervo do tema}"""
    for k, v in (("candidates", []), ("uses", {}), ("last", {})):
        ctx.setdefault(k, v)
    path = workdir / f"img_{idx:03d}.jpg"
    w, h = cfg["video"]["width"], cfg["video"]["height"]
    queries = [q for q in (scene.get("commons_queries") or [scene.get("commons_query", "")]) if q]
    q_tokens, n_tokens = tokens(" ".join(queries)), tokens(scene.get("narration", ""))

    # 1) acervo do tema, por afinidade (varia sozinho: cada imagem só entra uma vez)
    cand = pick_candidate(ctx["candidates"], ctx["used"], q_tokens, n_tokens, min_score=2)
    if cand and _download(cand, path, http):
        return _real(cand, path, "commons", "acervo", ctx, idx)

    # 2) busca no Commons, da consulta específica para as mais gerais
    tried = []
    for q in dict.fromkeys(fq for base in queries for fq in fallback_queries(base)):
        tried.append(q)
        try:
            found = search_candidates(q, cfg, http, limit=20)
        except Exception as e:
            print(f"  ! Commons falhou na cena {idx} ('{q}': {str(e)[:70]})")
            continue
        known = {c["title"] for c in ctx["candidates"]}
        ctx["candidates"] += [c for c in found if c["title"] not in known]      # alimenta o acervo
        hit = next((c for c in found if c["title"] not in ctx["used"]), None)
        if hit and _download(hit, path, http):
            return _real(hit, path, "commons", f"busca '{q}'", ctx, idx)

    # 3) IA (opcional, pago)
    if cfg["images"]["ai_fallback"] and ctx["ai_ok"] and (ai_client or os.environ.get("MUAPI_API_KEY")):
        try:
            client = ai_client or muapi.MuapiClient()
            client.text_to_image(f"{scene['ai_prompt']}, {cfg['images']['ai_style']}", cfg["images"]["ai_model"], path)
            _save(Image.open(path), path)
            info = {"path": path, "kind": "ai", "credit": None, "how": "ia"}
            ctx["pool"].append(info)
            ctx["uses"][str(path)] = 1
            ctx["last"][str(path)] = idx
            return info
        except Exception as e:
            print(f"  ! IA falhou na cena {idx} ({str(e)[:90]})")
            if "402" in str(e) or "INSUFFICIENT" in str(e).upper():
                ctx["ai_ok"] = False
                print("  ! sem crédito na MuAPI: IA desligada pelo resto deste vídeo")

    # 4) imagem do acervo ainda não usada, mesmo com pouca afinidade (melhor que repetir)
    cand = pick_candidate(ctx["candidates"], ctx["used"], q_tokens, n_tokens, min_score=0)
    if cand and _download(cand, path, http):
        return _real(cand, path, "commons", "acervo (afinidade baixa)", ctx, idx)

    # 5) repetir a imagem real MENOS usada (e há mais tempo sem aparecer), nunca sempre as mesmas
    if ctx["pool"]:
        src = min(ctx["pool"], key=lambda p: (ctx["uses"].get(str(p["path"]), 1), ctx["last"].get(str(p["path"]), -1)))
        ctx["uses"][str(src["path"])] = ctx["uses"].get(str(src["path"]), 1) + 1
        ctx["last"][str(src["path"])] = idx
        shutil.copyfile(src["path"], path)
        return {"path": path, "kind": "reuse", "credit": None, "how": f"reuso (buscas sem resultado: {tried[:3]})"}
    card(scene.get("chapter") or "", w, h, path, idx)
    return {"path": path, "kind": "card", "credit": None, "how": "cartão"}
