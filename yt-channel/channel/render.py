"""Monta o vídeo: Ken Burns por cena + narração + legendas queimadas + trilha opcional."""
from __future__ import annotations

import random
import subprocess
from pathlib import Path

from .meta import PAD


def _run(cmd: list[str], cwd: Path | None = None) -> None:
    subprocess.run(cmd, check=True, cwd=cwd, capture_output=True)


# (modo, foco x, foco y): enquadramentos variados para que planos seguidos da mesma imagem não pareçam repetidos
VARIANTS = [("in", 0.50, 0.50), ("pan_lr", 0.00, 0.45), ("out", 0.30, 0.40),
            ("in", 0.75, 0.35), ("pan_rl", 1.00, 0.55), ("in", 0.25, 0.65)]


def _zoompan(variant: tuple, frames: int) -> str:
    mode, fx, fy = variant
    fx_expr, fy_expr = f"(iw-iw/zoom)*{fx}", f"(ih-ih/zoom)*{fy}"
    if mode == "in":
        return f"z='min(zoom+0.0007,1.22)':x='{fx_expr}':y='{fy_expr}'"
    if mode == "out":
        return f"z='if(eq(on,1),1.22,max(zoom-0.0007,1.0))':x='{fx_expr}':y='{fy_expr}'"
    pos = f"on/{max(frames, 1)}" if mode == "pan_lr" else f"(1-on/{max(frames, 1)})"
    return f"z=1.18:x='(iw-iw/zoom)*{pos}':y='{fy_expr}'"


def shot_frames(total_seconds: float, fps: int, shot_seconds: float, max_shots: int = 4) -> list[int]:
    """Divide a cena em planos de ~shot_seconds (1 a max_shots), somando exatamente os quadros da cena."""
    total = max(int(total_seconds * fps), 1)
    n = max(1, min(max_shots, round(total_seconds / shot_seconds)))
    base, extra = divmod(total, n)
    return [base + (1 if k < extra else 0) for k in range(n)]


def chapter_card(text: str, w: int, h: int, path: Path) -> Path:
    """Título do capítulo (canto superior esquerdo) como PNG transparente."""
    from PIL import Image, ImageDraw

    from .thumb import _font

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    size = max(int(h * 0.05), 18)
    font = _font(size)
    label = text.upper()
    tw = d.textlength(label, font=font)
    x, y, pad = int(w * 0.04), int(h * 0.06), int(size * 0.5)
    d.rounded_rectangle((x, y, x + tw + pad * 3, y + size + pad * 2), radius=pad // 2, fill=(0, 0, 0, 170))
    d.rectangle((x, y, x + max(pad // 3, 4), y + size + pad * 2), fill=(255, 212, 0, 255))
    d.text((x + pad * 1.6, y + pad * 0.85), label, font=font, fill=(255, 255, 255, 255))
    img.save(path)
    return path


def scene_clip(img: Path, audio: Path, dur: float, i: int, out: Path, w: int, h: int, fps: int,
               motion: dict | None = None, chapter_png: Path | None = None) -> None:
    motion = motion or {}
    total = dur + PAD
    shots = shot_frames(total, fps, motion.get("shot_seconds", 5.0)) if motion.get("shots", True) \
        else [max(int(total * fps), 1)]
    n = len(shots)
    W, H = int(w * 1.5), int(h * 1.5)
    graph = f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
    graph += (",split=%d%s;" % (n, "".join(f"[s{k}]" for k in range(n)))) if n > 1 else "[s0];"
    for k, frames in enumerate(shots):
        variant = VARIANTS[(i * 2 + k) % len(VARIANTS)]
        graph += f"[s{k}]zoompan={_zoompan(variant, frames)}:d={frames}:s={w}x{h}:fps={fps}[v{k}];"
    graph += "".join(f"[v{k}]" for k in range(n)) + f"concat=n={n}:v=1:a=0[vc];"
    post = "vignette=PI/5," if motion.get("grain", True) else ""
    post += f"noise=alls={int(motion.get('grain_strength', 3))}:allf=t," if motion.get("grain", True) else ""
    post += f"fade=t=in:d=0.3,fade=t=out:st={max(total - 0.3, 0):.2f}:d=0.3,format=yuv420p"
    graph += f"[vc]{post}[vf]"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(img), "-i", str(audio)]
    last = "[vf]"
    if chapter_png:
        cmd += ["-i", str(chapter_png)]
        graph += f";[vf][2:v]overlay=0:0:enable='between(t,0.4,3.4)'[vo]"
        last = "[vo]"
    _run(cmd + ["-filter_complex", graph, "-map", last, "-map", "1:a", "-af", "apad", "-t", f"{total:.2f}",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
                "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "160k", str(out)])


def pick_music(music_dir: str, seed: str) -> Path | None:
    files = sorted(p for p in Path(music_dir).glob("*") if p.suffix.lower() in (".mp3", ".wav", ".m4a"))
    return random.Random(seed).choice(files) if files else None


def render(scenes: list[dict], images: list[Path], durations: list[float], srt_text: str, workdir: Path,
           out: Path, cfg: dict, seed: str) -> bool:
    """Devolve True se usou trilha de fundo."""
    v = cfg["video"]
    parts = []
    for i, (s, img, d) in enumerate(zip(scenes, images, durations)):
        clip = workdir / f"clip_{i:03d}.mp4"
        motion = v.get("motion", {})
        card = None
        if motion.get("chapter_cards", True) and i > 0 and s.get("chapter"):
            card = chapter_card(s["chapter"], v["width"], v["height"], workdir / f"chapter_{i:03d}.png")
        scene_clip(img, s["audio"], d, i, clip, v["width"], v["height"], v["fps"], motion, card)
        parts.append(clip)
    listing = workdir / "list.txt"
    listing.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    joined = workdir / "joined.mp4"
    _run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
          "-c", "copy", str(joined)])

    music = pick_music(cfg["music_dir"], seed)
    burn = v["burn_subtitles"]
    if not music and not burn:
        joined.replace(out)
        return False

    (workdir / "subs.srt").write_text(srt_text, encoding="utf-8")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", "joined.mp4"]
    if music:
        cmd += ["-stream_loop", "-1", "-i", str(music.resolve())]
    vf = ""
    if burn:
        # libass trata SRT numa grade de 288 linhas e escala para a altura real do vídeo
        style = "FontName=DejaVu Sans,Fontsize=14,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000," \
                "Outline=1.2,Shadow=0,Alignment=2,MarginV=16"
        vf = f"subtitles=subs.srt:force_style='{style}'"
    if vf:
        cmd += ["-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22"]
    else:
        cmd += ["-c:v", "copy"]
    if music:
        total = sum(durations) + PAD * len(durations)
        cmd += ["-filter_complex",
                f"[1:a]volume={v['music_volume']},afade=t=out:st={max(total - 3, 0):.1f}:d=3[m];"
                "[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]",
                "-map", "0:v", "-map", "[a]"]
    cmd += ["-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out.resolve())]
    _run(cmd, cwd=workdir)
    return bool(music)
