"""Narração por cena (edge-tts). Durações reais vêm do áudio, não de estimativa."""
from __future__ import annotations

import asyncio
import subprocess
import time
from pathlib import Path


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def synthesize(text: str, out: Path, voice: str, rate: str, retries: int = 3) -> float:
    import edge_tts

    last: Exception | None = None
    for attempt in range(retries):
        try:
            asyncio.run(edge_tts.Communicate(text, voice, rate=rate).save(str(out)))
            return duration(out)
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"TTS falhou: {last}")


def silent(text: str, out: Path) -> float:
    """Só para testes/demonstração offline: silêncio com duração proporcional ao texto."""
    secs = max(len(text.split()) * 0.4, 1.0)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                    "-t", f"{secs:.2f}", "-c:a", "libmp3lame", str(out)], check=True)
    return secs


def narrate(scenes: list[dict], workdir: Path, cfg: dict, offline: bool = False) -> list[float]:
    durs = []
    for i, s in enumerate(scenes):
        out = workdir / f"voice_{i:03d}.mp3"
        durs.append(silent(s["narration"], out) if offline
                    else synthesize(s["narration"], out, cfg["voice"]["name"], cfg["voice"]["rate"]))
        s["audio"] = out
    return durs
