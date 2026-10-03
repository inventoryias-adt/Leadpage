"""CLI: escolhe um tema, pesquisa, escreve, narra, monta o vídeo e (opcional) sobe como privado.

  python -m channel.run                  # próximo tema de data/topics.yaml, com upload
  python -m channel.run --no-upload      # só gera o pacote em output/
  python -m channel.run --topic "A Peste Negra" --wiki "Peste Negra"
"""
from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
import unicodedata
from pathlib import Path

from . import images, meta, muapi, render, research, script as scriptmod, state, thumb, voice
from .config import load_config
from .youtube import YouTube


def slug(text: str) -> str:
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:60] or "video"


def build(topic: dict, cfg: dict, offline: bool = False, article: dict | None = None,
          script: dict | None = None, ai_client=None) -> dict:
    """Gera todos os arquivos do vídeo e devolve o dicionário de metadados."""
    out_dir = Path(cfg["output_dir"]) / slug(topic["title"])
    out_dir.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="ytwork_"))

    print(f"[1/6] Pesquisando: {topic['wiki']}")
    article = article or research.fetch_article(topic["wiki"], cfg["wikipedia_lang"], cfg["source_max_chars"])

    print("[2/6] Roteiro + verificação de fatos")
    if script is None:
        script = scriptmod.generate(topic["title"], article, cfg)
        script, issues = scriptmod.verify_and_fix(script, article, cfg)
        print(f"      {len(script['scenes'])} cenas; {len(issues)} trechos corrigidos pela checagem")
    scenes = script["scenes"]

    print("[3/6] Narração")
    durations = voice.narrate(scenes, work, cfg, offline=offline)

    print("[4/6] Imagens")
    ctx = {"used": set(), "pool": [], "ai_ok": True}
    if ai_client is None and cfg["images"]["ai_fallback"] and os.environ.get("MUAPI_API_KEY"):
        ai_client = muapi.MuapiClient()
    infos = [images.scene_image(s, i, cfg, work, ctx, ai_client) if not offline
             else {"path": images.card(s.get("chapter") or "", cfg["video"]["width"], cfg["video"]["height"],
                                       work / f"img_{i:03d}.jpg", i), "kind": "card", "credit": None}
             for i, s in enumerate(scenes)]

    print("[5/6] Montando vídeo")
    srt_text = meta.srt(scenes, durations)
    video = out_dir / "video.mp4"
    render.render(scenes, [i["path"] for i in infos], durations, srt_text, work, video, cfg, seed=topic["title"])
    (out_dir / "subtitles.srt").write_text(srt_text, encoding="utf-8")
    cover_src = next((i["path"] for i in infos if i["kind"] != "card"), infos[0]["path"])
    thumb_path = thumb.make(cover_src, script["thumb_text"], out_dir / "thumbnail.jpg")

    print("[6/6] Metadados")
    credits = [i["credit"] for i in infos if i["credit"]]
    used_ai = any(i["kind"] == "ai" for i in infos)
    md = {
        "title": script["title"],
        "description": meta.description(script, article, meta.chapters(scenes, durations), credits, cfg, used_ai),
        "tags": script["tags"], "category_id": cfg["youtube"]["category_id"], "language": cfg["language"],
        "privacy": cfg["youtube"]["privacy"], "made_for_kids": cfg["youtube"]["made_for_kids"],
        "synthetic": bool(cfg["youtube"]["disclose_synthetic"]),
        "seconds": round(sum(durations) + meta.PAD * len(durations)), "source": article["url"],
        "image_kinds": {k: sum(1 for i in infos if i["kind"] == k) for k in ("commons", "ai", "reuse", "card")},
    }
    (out_dir / "metadata.json").write_text(json.dumps(md, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "script.json").write_text(json.dumps(
        {**script, "scenes": [{k: v for k, v in s.items() if k != "audio"} for s in scenes]},
        ensure_ascii=False, indent=2), encoding="utf-8")
    md.update(video=video, thumbnail=thumb_path, dir=out_dir)
    return md


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic")
    ap.add_argument("--wiki", help="título do artigo da Wikipédia (padrão: igual ao tema)")
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--config")
    args = ap.parse_args(argv)

    cfg = load_config(args.config)
    published = state.load_published(cfg["published_path"])
    topic = ({"title": args.topic, "wiki": args.wiki or args.topic} if args.topic
             else state.next_topic(cfg["topics_path"], published))
    if not topic:
        print("Sem temas novos em data/topics.yaml — adicione mais.")
        return 1
    print(f"Tema: {topic['title']}")

    md = build(topic, cfg)
    print(f"Vídeo pronto: {md['video']} (~{md['seconds'] // 60} min)")
    if args.no_upload:
        return 0
    cards = md["image_kinds"]["card"]
    if cards / max(sum(md["image_kinds"].values()), 1) > cfg["images"]["max_card_ratio"]:
        print(f"Upload cancelado: {cards} cenas ficaram só com cartão de cor (sem imagem). "
              f"Veja {md['dir']} e tente de novo (limite do Commons ou IA sem crédito).")
        return 2
    missing = [k for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN") if not os.environ.get(k)]
    if missing:
        print(f"Upload pulado (faltam {', '.join(missing)}): baixe o vídeo em {md['dir']} e suba pelo YouTube Studio.")
        return 0
    video_id = YouTube().upload(md["video"], md, md["thumbnail"])
    print(f"Enviado como {md['privacy']}: https://studio.youtube.com/video/{video_id}/edit")
    state.mark_published(cfg["published_path"], {"topic": topic["title"], "youtube_id": video_id,
                                                 "title": md["title"]})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
