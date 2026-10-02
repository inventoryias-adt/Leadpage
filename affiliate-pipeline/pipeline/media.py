"""Monta slides (Pillow) e o vídeo vertical (ffmpeg) a partir das imagens do anúncio."""
from __future__ import annotations

import io
import subprocess
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for f in FONT_CANDIDATES:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def fetch_image(src: str) -> Image.Image:
    if src.startswith(("http://", "https://")):
        r = requests.get(src, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")
    return Image.open(src).convert("RGB")


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_w: int) -> list[str]:
    lines: list[str] = []
    for para in text.split("\n"):
        cur = ""
        for word in para.split():
            test = f"{cur} {word}".strip()
            if draw.textlength(test, font=font) <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


def render_slide(img: Image.Image, text: str, w: int, h: int, accent: str, price: bool, variant: int) -> Image.Image:
    # fundo: a própria imagem em cover + blur + escurecida
    bg = img.copy()
    scale = max(w / bg.width, h / bg.height)
    bg = bg.resize((int(bg.width * scale), int(bg.height * scale)), Image.LANCZOS)
    bg = bg.crop(((bg.width - w) // 2, (bg.height - h) // 2, (bg.width + w) // 2, (bg.height + h) // 2))
    bg = bg.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int(v * 0.45))

    # produto: nítido e centralizado (variant muda o enquadramento entre cenas)
    fg = img.copy()
    max_w = int(w * 0.88)
    fscale = min(max_w / fg.width, (h * 0.46) / fg.height)
    fg = fg.resize((int(fg.width * fscale), int(fg.height * fscale)), Image.LANCZOS)
    x = (w - fg.width) // 2 + (-60 if variant % 2 else 60) * (variant > 0)
    y = int(h * 0.28)
    bg.paste(fg, (x, y))

    d = ImageDraw.Draw(bg)
    size = 76 if not price else 70
    font = _font(size)
    lines = _wrap(d, text, font, int(w * 0.86))
    line_h = int(size * 1.25)
    box_h = line_h * len(lines) + 60
    # faixa de texto no rodapé
    top = int(h * 0.80) - box_h // 2 if not price else int(h * 0.76)
    top = min(top, h - box_h - 120)
    d.rounded_rectangle((40, top, w - 40, top + box_h), radius=36, fill=accent if price else (0, 0, 0))
    for i, line in enumerate(lines):
        tw = d.textlength(line, font=font)
        d.text(((w - tw) / 2, top + 30 + i * line_h), line, font=font, fill="white",
               stroke_width=3, stroke_fill=(0, 0, 0))
    return bg


def allocate(segments: list[dict], total: float, min_each: float = 2.5) -> list[float]:
    weights = [max(len(s["spoken"]), 8) for s in segments]
    raw = [total * wt / sum(weights) for wt in weights]
    return [max(r, min_each) for r in raw]


def _segment_video(png: Path, out: Path, secs: float, w: int, h: int, fps: int, idx: int) -> None:
    frames = int(secs * fps)
    # alterna zoom-in / zoom-out para dar movimento a imagens estáticas
    if idx % 2 == 0:
        z = "min(zoom+0.0007,1.12)"
    else:
        z = "if(eq(on,0),1.12,max(zoom-0.0007,1.0))"
    vf = (
        f"scale={int(w * 1.5)}:{int(h * 1.5)},"
        f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={w}x{h}:fps={fps},"
        "format=yuv420p"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(png), "-vf", vf,
         "-t", f"{secs:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", str(out)],
        check=True,
    )


def build_video(slides: list[Path], durations: list[float], audio: Path | None, out: Path, vcfg: dict) -> None:
    w, h, fps = vcfg["width"], vcfg["height"], vcfg["fps"]
    tmp = out.parent / "_tmp"
    tmp.mkdir(exist_ok=True)
    parts = []
    for i, (png, secs) in enumerate(zip(slides, durations)):
        part = tmp / f"seg{i}.mp4"
        _segment_video(png, part, secs, w, h, fps, i)
        parts.append(part)
    listing = tmp / "list.txt"
    listing.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing)]
    if audio:
        cmd += ["-i", str(audio), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest"]
    else:
        cmd += ["-c:v", "copy", "-an"]
    cmd += ["-movflags", "+faststart", str(out)]
    subprocess.run(cmd, check=True)
    for p in parts + [listing]:
        p.unlink(missing_ok=True)
    tmp.rmdir()
