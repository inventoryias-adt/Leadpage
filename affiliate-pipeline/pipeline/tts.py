"""Locução pt-BR com edge-tts (gratuito). Falhou? segue sem áudio."""
from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path


def duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out.strip())


def synthesize(text: str, out_path: Path, voice: str, rate: str) -> float | None:
    try:
        import edge_tts

        async def run():
            await edge_tts.Communicate(text, voice, rate=rate).save(str(out_path))

        asyncio.run(run())
        return duration(str(out_path))
    except Exception as e:
        print(f"  ! TTS indisponível ({e}); vídeo sai sem locução")
        out_path.unlink(missing_ok=True)
        return None
