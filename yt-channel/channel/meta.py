"""Capítulos, legendas (SRT) e descrição do vídeo."""
from __future__ import annotations

import re

PAD = 0.35  # silêncio após cada cena


def ts(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def starts(durations: list[float]) -> list[float]:
    t, out = 0.0, []
    for d in durations:
        out.append(t)
        t += d + PAD
    return out


def chapters(scenes: list[dict], durations: list[float]) -> list[str]:
    """Regras do YouTube: começa em 0:00, mínimo 3 capítulos, cada um com 10 s ou mais."""
    marks = [(t, s["chapter"]) for t, s in zip(starts(durations), scenes) if s.get("chapter")]
    kept: list[tuple[float, str]] = []
    for t, name in marks:
        if not kept or t - kept[-1][0] >= 10:
            kept.append((t, name))
    if len(kept) < 3 or kept[0][0] != 0:
        return []
    return [f"{ts(t)} {name}" for t, name in kept]


def _sec(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms % 3600000 // 60000:02d}:{ms % 60000 // 1000:02d},{ms % 1000:03d}"


def _wrap2(text: str, width: int = 42) -> str:
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    return "\n".join(lines + [cur])


def _chunks(narration: str, max_chars: int = 84) -> list[str]:
    out: list[str] = []
    for sent in re.split(r"(?<=[.!?…])\s+", narration.strip()):
        cur = ""
        for w in sent.split():
            if len(cur) + len(w) + 1 > max_chars and cur:
                out.append(cur)
                cur = w
            else:
                cur = f"{cur} {w}".strip()
        if cur:
            out.append(cur)
    return out


def srt(scenes: list[dict], durations: list[float]) -> str:
    cues, n = [], 1
    for t0, s, d in zip(starts(durations), scenes, durations):
        chunks = _chunks(s["narration"])
        total = sum(len(c) for c in chunks) or 1
        t = t0
        for c in chunks:
            span = d * len(c) / total
            cues.append(f"{n}\n{_sec(t)} --> {_sec(t + span)}\n{_wrap2(c)}\n")
            t += span
            n += 1
    return "\n".join(cues)


def description(script: dict, source: dict, chapter_lines: list[str], credits: list[str], cfg: dict,
                used_ai: bool) -> str:
    parts = [script["summary"].strip()]
    if chapter_lines:
        parts.append("Capítulos:\n" + "\n".join(chapter_lines))
    parts.append(f"Fonte principal: {source['title']} — {source['url']} (Wikipédia, CC BY-SA 4.0).\n"
                 "O roteiro é uma narração original baseada nessa fonte.")
    if credits:
        parts.append("Imagens (Wikimedia Commons):\n" + "\n".join(f"• {c}" for c in credits))
    note = "Narração gerada por voz sintética."
    if used_ai:
        note += " Algumas ilustrações foram geradas por inteligência artificial."
    parts.append(note)
    parts.append(cfg["youtube"]["description_footer"])
    return "\n\n".join(parts)[:4900]
