"""data/published.json: temas já usados (commitado de volta pelo workflow)."""
from __future__ import annotations

import json
from pathlib import Path

import yaml


def load_published(path: str) -> list[dict]:
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def mark_published(path: str, entry: dict) -> None:
    items = load_published(path)
    items.append(entry)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def next_topic(topics_path: str, published: list[dict]) -> dict | None:
    done = {p["topic"].lower() for p in published}
    for t in yaml.safe_load(Path(topics_path).read_text(encoding="utf-8")) or []:
        t = {"title": t} if isinstance(t, str) else dict(t)
        t.setdefault("wiki", t["title"])
        if t["title"].lower() not in done:
            return t
    return None
