"""Narração por cena (edge-tts). Durações reais vêm do áudio, não de estimativa.

Ritmo: cada frase é sintetizada separada e as frases são unidas com pausas que dependem da pontuação
(pergunta, exclamação e reticências pedem mais respiro), o que evita a cadência "de leitor de notícias".
"""
from __future__ import annotations

import asyncio
import re
import subprocess
import time
from pathlib import Path

SENTENCE_SPLIT = re.compile(r"(?<=[.!?…])\s+")
DEFAULT_PAUSES = {"sentence": 0.35, "question": 0.45, "exclaim": 0.40, "ellipsis": 0.55}


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in SENTENCE_SPLIT.split(text.strip()) if p.strip()]
    return parts or [text.strip()]


def pause_after(sentence: str, pauses: dict | None = None) -> float:
    p = {**DEFAULT_PAUSES, **(pauses or {})}
    text = sentence.rstrip()
    if text.endswith(("...", "…")):
        return p["ellipsis"]
    return p.get({"?": "question", "!": "exclaim"}.get(text[-1:], "sentence"), p["sentence"])


def _save_sentences(sentences: list[str], paths: list[Path], voice: str, rate: str, pitch: str) -> None:
    """Sintetiza as frases em paralelo (uma conexão por frase)."""
    import edge_tts

    async def run():
        await asyncio.gather(*[
            edge_tts.Communicate(s, voice, rate=rate, pitch=pitch).save(str(p)) for s, p in zip(sentences, paths)])
    asyncio.run(run())


def synthesize(text: str, out: Path, voice: str, rate: str, pitch: str = "+0Hz", retries: int = 3) -> float:
    """Um bloco só, sem pausas controladas (usado nas amostras de comparação)."""
    last: Exception | None = None
    for attempt in range(retries):
        try:
            _save_sentences([text], [out], voice, rate, pitch)
            return duration(out)
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"TTS falhou: {last}")


def synthesize_paced(text: str, out: Path, voice: str, rate: str, pitch: str = "+0Hz",
                     pauses: dict | None = None, retries: int = 3) -> float:
    sentences = split_sentences(text)
    parts = [out.with_name(f"{out.stem}_s{i}.mp3") for i in range(len(sentences))]
    last: Exception | None = None
    for attempt in range(retries):
        try:
            _save_sentences(sentences, parts, voice, rate, pitch)
            break
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    else:
        raise RuntimeError(f"TTS falhou: {last}")
    n = len(parts)
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for p in parts:
        cmd += ["-i", str(p)]
    chains = []
    for i, s in enumerate(sentences):
        chain = f"[{i}:a]aresample=44100,aformat=channel_layouts=mono"
        if i < n - 1:                                 # a última frase não leva pausa (a cena já tem a sua)
            chain += f",apad=pad_dur={pause_after(s, pauses):.2f}"
        chains.append(f"{chain}[a{i}]")
    graph = ";".join(chains) + ";" + "".join(f"[a{i}]" for i in range(n)) + f"concat=n={n}:v=0:a=1[out]"
    subprocess.run(cmd + ["-filter_complex", graph, "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "3", str(out)],
                   check=True, capture_output=True)
    for p in parts:
        p.unlink(missing_ok=True)
    return duration(out)


def silent(text: str, out: Path) -> float:
    """Só para testes/demonstração offline: silêncio com duração proporcional ao texto."""
    secs = max(len(text.split()) * 0.4, 1.0)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                    "-t", f"{secs:.2f}", "-c:a", "libmp3lame", str(out)], check=True)
    return secs


def narrate(scenes: list[dict], workdir: Path, cfg: dict, offline: bool = False) -> list[float]:
    v = cfg["voice"]
    durs = []
    for i, s in enumerate(scenes):
        out = workdir / f"voice_{i:03d}.mp3"
        if offline:
            durs.append(silent(s["narration"], out))
        elif v.get("paced", True):
            durs.append(synthesize_paced(s["narration"], out, v["name"], v["rate"], v.get("pitch", "+0Hz"),
                                         v.get("pauses")))
        else:
            durs.append(synthesize(s["narration"], out, v["name"], v["rate"], v.get("pitch", "+0Hz")))
        s["audio"] = out
    return durs
