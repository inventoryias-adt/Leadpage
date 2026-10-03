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
import urllib.parse
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
    if len(article["text"]) < cfg["min_source_chars"]:
        raise SystemExit(f"Fonte curta demais ({len(article['text'])} caracteres) em '{article['title']}': "
                         "a Wikipédia não tem material suficiente. Escolha outro artigo com --wiki.")

    print("[2/6] Roteiro + verificação de fatos")
    if script is None:
        script = scriptmod.generate(topic["title"], article, cfg, note=topic.get("note", ""))
        script, issues = scriptmod.verify_and_fix(script, article, cfg)
        print(f"      {len(script['scenes'])} cenas; {len(issues)} trechos corrigidos pela checagem")
    scenes = script["scenes"]

    print("[3/6] Narração")
    durations = voice.narrate(scenes, work, cfg, offline=offline)

    print("[4/6] Imagens")
    ctx = {"used": set(), "pool": [], "ai_ok": True, "candidates": [], "uses": {}, "last": {}}
    pool_stats: dict = {}
    if not offline:
        ctx["candidates"], pool_stats = images.build_pool(article["title"], topic["title"], cfg)
        print(f"      acervo do tema: {pool_stats.get('acervo', 0)} imagens livres; descartadas: "
              + (", ".join(f"{k}={v}" for k, v in pool_stats.items() if k != "acervo") or "nenhuma"))
    if ai_client is None and cfg["images"]["ai_fallback"] and os.environ.get("MUAPI_API_KEY"):
        ai_client = muapi.MuapiClient()
    infos = []
    for i, sc in enumerate(scenes):
        if offline:
            info = {"path": images.card(sc.get("chapter") or "", cfg["video"]["width"], cfg["video"]["height"],
                                        work / f"img_{i:03d}.jpg", i), "kind": "card", "credit": None, "how": "offline"}
        else:
            info = images.scene_image(sc, i, cfg, work, ctx, ai_client)
        infos.append(info)
        print(f"      cena {i:02d}: {info['kind']:<7} {info.get('how', '')}")
    distinct = len({i["credit"] for i in infos if i["credit"]})
    print(f"      {distinct} imagens distintas em {len(infos)} cenas")

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
        "topic": topic["title"],
        "title": script["title"],
        "description": meta.description(script, article, meta.chapters(scenes, durations), credits, cfg, used_ai),
        "tags": script["tags"], "category_id": cfg["youtube"]["category_id"], "language": cfg["language"],
        "privacy": cfg["youtube"]["privacy"], "made_for_kids": cfg["youtube"]["made_for_kids"],
        "synthetic": bool(cfg["youtube"]["disclose_synthetic"]),
        "seconds": round(sum(durations) + meta.PAD * len(durations)), "source": article["url"],
        "image_kinds": {k: sum(1 for i in infos if i["kind"] == k) for k in ("commons", "ai", "reuse", "card")},
        "distinct_images": distinct, "pool_stats": pool_stats,
    }
    (out_dir / "metadata.json").write_text(json.dumps(md, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "script.json").write_text(json.dumps(
        {**script, "scenes": [{k: v for k, v in s.items() if k != "audio"} for s in scenes]},
        ensure_ascii=False, indent=2), encoding="utf-8")
    md.update(video=video, thumbnail=thumb_path, dir=out_dir)
    return md


def load_package(cfg: dict, topic_title: str | None = None) -> dict:
    """Lê um pacote já gerado em output/<tema>/ (ex.: baixado do artefato de outra execução)."""
    out = Path(cfg["output_dir"])
    if topic_title:
        folder = out / slug(topic_title)
    else:
        found = [d for d in out.iterdir() if (d / "metadata.json").exists()] if out.exists() else []
        if len(found) != 1:
            raise SystemExit(f"Esperava exatamente 1 pacote em {out}, achei {len(found)}. Use --topic para escolher.")
        folder = found[0]
    meta_file = folder / "metadata.json"
    if not meta_file.exists():
        raise SystemExit(f"Pacote não encontrado: {meta_file}")
    md = json.loads(meta_file.read_text(encoding="utf-8"))
    md.update(video=folder / "video.mp4", thumbnail=folder / "thumbnail.jpg", dir=folder)
    for f in ("video", "thumbnail"):
        if not md[f].exists():
            raise SystemExit(f"Arquivo ausente no pacote: {md[f]}")
    md.setdefault("topic", topic_title or md["title"])
    return md


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic")
    ap.add_argument("--wiki", help="título do artigo da Wikipédia (padrão: igual ao tema)")
    ap.add_argument("--note", help="orientação de abordagem para o roteiro deste tema")
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--upload-only", action="store_true",
                    help="não gera nada: sobe o pacote já existente em output/ (use --topic se houver mais de um)")
    ap.add_argument("--rerender", action="store_true",
                    help="refaz voz/imagens/vídeo de um pacote existente a partir do script.json, sem chamar o Claude")
    ap.add_argument("--config")
    args = ap.parse_args(argv)

    # o workflow passa os dados por variáveis de ambiente (nada de montar comandos de shell com texto digitado)
    env = os.environ
    args.topic = args.topic or env.get("CH_TOPIC") or None
    args.wiki = args.wiki or env.get("CH_WIKI") or None
    args.note = args.note or env.get("CH_NOTE") or None
    args.no_upload = args.no_upload or env.get("CH_UPLOAD") == "false"
    args.rerender = args.rerender or env.get("CH_RERENDER") == "true"
    args.upload_only = args.upload_only or (bool(env.get("CH_REUSE")) and not args.rerender)

    cfg = load_config(args.config)
    if args.rerender:
        return rerender(cfg, args)
    if args.upload_only:
        return upload_only(cfg, args)
    published = state.load_published(cfg["published_path"])
    topic = ({"title": args.topic, "wiki": args.wiki or args.topic, "note": args.note or ""} if args.topic
             else state.next_topic(cfg["topics_path"], published))
    if not topic:
        print("Sem temas novos em data/topics.yaml — adicione mais.")
        return 1
    print(f"Tema: {topic['title']}")

    yt = None
    if not args.no_upload and all(os.environ.get(k) for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN")):
        # falha cedo: não adianta gastar minutos e créditos gerando um vídeo que não poderá subir
        yt = YouTube()
        for problem in yt.format_problems():
            print(f"! {problem}")
        yt.access_token()
        print("Credenciais do YouTube OK.")

    md = build(topic, cfg)
    print(f"Vídeo pronto: {md['video']} (~{md['seconds'] // 60} min)")
    if args.no_upload:
        return 0
    return publish(md, cfg, topic["title"], yt)


def publish(md: dict, cfg: dict, topic_title: str, yt: YouTube | None = None) -> int:
    cards = md["image_kinds"]["card"]
    if cards / max(sum(md["image_kinds"].values()), 1) > cfg["images"]["max_card_ratio"]:
        print(f"Upload cancelado: {cards} cenas ficaram só com cartão de cor (sem imagem). "
              f"Veja {md['dir']} e tente de novo (limite do Commons ou IA sem crédito).")
        return 2
    missing = [k for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN") if not os.environ.get(k)]
    if missing:
        print(f"Upload pulado (faltam {', '.join(missing)}): baixe o vídeo em {md['dir']} e suba pelo YouTube Studio.")
        return 0
    video_id = (yt or YouTube()).upload(md["video"], md, md["thumbnail"])
    print(f"Enviado como {md['privacy']}: https://studio.youtube.com/video/{video_id}/edit")
    state.mark_published(cfg["published_path"], {"topic": topic_title, "youtube_id": video_id, "title": md["title"]})
    return 0


def rerender(cfg: dict, args) -> int:
    """Refaz voz, imagens e vídeo de um pacote existente usando o script.json dele (sem chamar o Claude)."""
    md = load_package(cfg, args.topic)
    script = json.loads((md["dir"] / "script.json").read_text(encoding="utf-8"))
    wiki = urllib.parse.unquote(md["source"].rsplit("/", 1)[-1]).replace("_", " ")
    topic = {"title": md["topic"], "wiki": wiki, "note": ""}
    print(f"Re-renderizando '{md['title']}' (fonte: {wiki}) sem chamar o Claude")
    new = build(topic, cfg, script=script)
    print(f"Vídeo pronto: {new['video']} (~{new['seconds'] // 60} min)")
    if args.no_upload:
        return 0
    return publish(new, cfg, topic["title"])


def upload_only(cfg: dict, args) -> int:
    md = load_package(cfg, args.topic)
    print(f"Pacote existente: {md['dir']} (~{md['seconds'] // 60} min) — título: {md['title']}")
    if args.no_upload:
        print("Modo --no-upload: pacote conferido, nada foi enviado.")
        return 0
    missing = [k for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN") if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"Faltam credenciais: {', '.join(missing)}")
    yt = YouTube()
    for problem in yt.format_problems():
        print(f"! {problem}")
    video_id = yt.upload(md["video"], md, md["thumbnail"])
    print(f"Enviado como {md['privacy']}: https://studio.youtube.com/video/{video_id}/edit")
    state.mark_published(cfg["published_path"], {"topic": md["topic"], "youtube_id": video_id, "title": md["title"]})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
