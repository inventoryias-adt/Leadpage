"""Gera o pacote final de um produto e o registra na fila."""
from __future__ import annotations

import csv
import json
import time
from pathlib import Path

from . import copywriter, media, tts
from .models import Product


def build_package(p: Product, cfg: dict, out_root: Path, use_voice: bool = True) -> Path:
    day = time.strftime("%Y-%m-%d")
    folder = out_root / day / f"{p.platform}_{p.product_id}"
    slides_dir = folder / "slides"
    slides_dir.mkdir(parents=True, exist_ok=True)
    vcfg = cfg["video"]

    copy = copywriter.generate(p, cfg)
    segments = copy.segments(copywriter.brl(p.price))

    # voz
    audio_path, total = None, None
    if use_voice and cfg["voice"]["enabled"]:
        spoken = " ... ".join(s["spoken"] for s in segments)
        audio_path = folder / "voice.mp3"
        total = tts.synthesize(spoken, audio_path, cfg["voice"]["name"], cfg["voice"]["rate"])
        if total is None:
            audio_path = None
    durations = media.allocate(segments, max(total or 0, vcfg["min_seconds"]))
    if audio_path:  # garante que o vídeo cobre toda a locução
        durations[-1] += max(0.0, (total or 0) - sum(durations)) + 0.4

    # slides (1 imagem do anúncio é reaproveitada com enquadramentos diferentes)
    imgs = [media.fetch_image(u) for u in p.image_urls[:4]]
    slide_paths = []
    for i, seg in enumerate(segments):
        img = imgs[i % len(imgs)]
        slide = media.render_slide(img, seg["text"], vcfg["width"], vcfg["height"],
                                   vcfg["accent_color"], seg.get("price", False), i)
        sp = slides_dir / f"{i + 1:02d}.jpg"
        slide.save(sp, quality=92)
        slide_paths.append(sp)

    video = folder / "video.mp4"
    media.build_video(slide_paths, durations, audio_path, video, vcfg)
    (folder / "cover.jpg").write_bytes(slide_paths[0].read_bytes())
    caption = copywriter.full_caption(copy, p, cfg)
    (folder / "caption.txt").write_text(caption, encoding="utf-8")
    (folder / "manifest.json").write_text(
        json.dumps({"product": p.to_dict(), "script": segments, "caption": caption,
                    "video_seconds": round(sum(durations), 1), "voice": bool(audio_path)},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    _append_queue(out_root, p, folder, day)
    return folder


def _append_queue(out_root: Path, p: Product, folder: Path, day: str) -> None:
    qfile = out_root / "queue.csv"
    new = not qfile.exists()
    with open(qfile, "a", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["date", "platform", "product", "price", "commission_rate", "link", "folder", "status"])
        w.writerow([day, p.platform, p.title, p.price, p.commission_rate, p.affiliate_url,
                    str(folder.relative_to(out_root)), "pending"])
