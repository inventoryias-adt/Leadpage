from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent


def load_config(path: str | Path | None = None) -> dict:
    with open(Path(path) if path else ROOT / "config.yaml", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    cfg["output_dir"] = str(ROOT / cfg["output_dir"])
    cfg["published_path"] = str(ROOT / cfg["published_path"])
    cfg["music_dir"] = str(ROOT / "assets" / "music")
    cfg["topics_path"] = str(ROOT / "data" / "topics.yaml")
    return cfg
