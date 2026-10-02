"""Miniatura 1280x720 (JPEG < 2 MB): imagem escurecida + texto grande."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONTS = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
         "/Library/Fonts/Arial Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"]


def _font(size: int):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def make(image: Path, text: str, out: Path) -> Path:
    W, H = 1280, 720
    img = Image.open(image).convert("RGB")
    s = max(W / img.width, H / img.height)
    img = img.resize((int(img.width * s), int(img.height * s)), Image.LANCZOS)
    img = img.crop(((img.width - W) // 2, (img.height - H) // 2, (img.width + W) // 2, (img.height + H) // 2))
    shade = Image.new("L", (W, H))
    sd = ImageDraw.Draw(shade)
    for x in range(W):  # escurece mais à esquerda, onde fica o texto
        sd.line((x, 0, x, H), fill=int(210 * max(0.0, 1 - x / (W * 0.9))))
    img = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), img, shade)
    d = ImageDraw.Draw(img)
    words, lines = text.upper().split(), []
    for w in words:  # no máximo 2 palavras por linha
        if lines and len(lines[-1].split()) < 2:
            lines[-1] += " " + w
        else:
            lines.append(w)
    size = 150 if len(lines) <= 2 else 120
    f = _font(size)
    y = (H - len(lines) * int(size * 1.1)) // 2
    for line in lines:
        while d.textlength(line, font=f) > W * 0.62 and f.size > 60:
            f = _font(f.size - 6)
        d.text((60, y), line, font=f, fill=(255, 212, 0), stroke_width=8, stroke_fill=(0, 0, 0))
        y += int(f.size * 1.1)
    img.save(out, quality=88)
    return out
