"""Monta o vídeo: Ken Burns por cena + narração + legendas queimadas + trilha opcional."""
from __future__ import annotations

import random
import subprocess
from pathlib import Path

from .meta import PAD


def _run(cmd: list[str], cwd: Path | None = None) -> None:
    subprocess.run(cmd, check=True, cwd=cwd, capture_output=True)


def _zoompan(i: int, frames: int) -> str:
    cx, cy = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    mode = i % 4
    if mode == 0:
        return f"z='min(zoom+0.0006,1.15)':x='{cx}':y='{cy}'"
    if mode == 1:
        return f"z='if(eq(on,1),1.15,max(zoom-0.0006,1.0))':x='{cx}':y='{cy}'"
    if mode == 2:
        return f"z=1.15:x='(iw-iw/zoom)*on/{frames}':y='{cy}'"
    return f"z=1.15:x='(iw-iw/zoom)*(1-on/{frames})':y='{cy}'"


def scene_clip(img: Path, audio: Path, dur: float, i: int, out: Path, w: int, h: int, fps: int) -> None:
    total = dur + PAD
    frames = int(total * fps)
    vf = (f"scale={int(w * 1.5)}:{int(h * 1.5)}:force_original_aspect_ratio=increase,"
          f"crop={int(w * 1.5)}:{int(h * 1.5)},"
          f"zoompan={_zoompan(i, frames)}:d={frames}:s={w}x{h}:fps={fps},"
          f"fade=t=in:d=0.3,fade=t=out:st={max(total - 0.3, 0):.2f}:d=0.3,format=yuv420p")
    _run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(img), "-i", str(audio),
          "-vf", vf, "-af", "apad", "-t", f"{total:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
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
        scene_clip(img, s["audio"], d, i, clip, v["width"], v["height"], v["fps"])
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
