from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent


def load_config(path: str | Path | None = None) -> dict:
    path = Path(path) if path else ROOT / "config.yaml"
    with open(path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    for key in ("output_dir", "db_path"):
        cfg[key] = str(ROOT / cfg[key])
    cfg["tiktok_shop"]["csv_path"] = str(ROOT / cfg["tiktok_shop"]["csv_path"])
    return cfg
