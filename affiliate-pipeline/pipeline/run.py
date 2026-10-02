"""CLI do pipeline.

  python -m pipeline.run                    # shopee + tiktok csv, gera pacotes
  python -m pipeline.run --source mock      # teste offline, sem credenciais
  python -m pipeline.run --discover-only    # só lista os escolhidos
"""
from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path

from . import notify, package, select as selector
from .config import load_config
from .db import State
from .sources import mock, shopee, tiktok_csv


def gather(source: str, cfg: dict) -> list:
    cands = []
    if source in ("shopee", "all"):
        if os.environ.get("SHOPEE_APP_ID") and os.environ.get("SHOPEE_SECRET"):
            cands += shopee.fetch_candidates(cfg, cfg["min_commission_rate"])
        elif source == "shopee":
            raise SystemExit("Defina SHOPEE_APP_ID e SHOPEE_SECRET (ver .env.example)")
        else:
            print("! Shopee pulada: SHOPEE_APP_ID/SHOPEE_SECRET não definidos")
    if source in ("tiktok", "all"):
        cands += tiktok_csv.load(cfg["tiktok_shop"]["csv_path"])
    if source == "mock":
        cands += mock.load(Path(tempfile.mkdtemp(prefix="affmock_")))
    return cands


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["all", "shopee", "tiktok", "mock"], default="all")
    ap.add_argument("--limit", type=int, help="sobrescreve daily_limit")
    ap.add_argument("--no-voice", action="store_true")
    ap.add_argument("--discover-only", action="store_true")
    ap.add_argument("--config")
    args = ap.parse_args(argv)

    cfg = load_config(args.config)
    if args.limit:
        cfg["daily_limit"] = args.limit
    state = State(cfg["db_path"])

    cands = gather(args.source, cfg)
    chosen = selector.pick(cands, cfg, state.seen)
    print(f"{len(cands)} candidatos -> {len(chosen)} aprovados (comissão >= {cfg['min_commission_rate']:.0%})")

    shopee_picks = [p for p in chosen if p.platform == "shopee" and not p.affiliate_url.startswith("https://s.shopee")]
    if shopee_picks and not args.discover_only and args.source != "mock":
        shopee.attach_short_links(shopee_picks, cfg)

    for p in chosen:
        print(f"- [{p.platform}] {p.title[:60]} | R$ {p.price:.2f} | {p.commission_rate:.0%} "
              f"(≈ R$ {p.commission_value:.2f}/venda)")
        if args.discover_only:
            continue
        try:
            folder = package.build_package(p, cfg, Path(cfg["output_dir"]), use_voice=not args.no_voice)
        except Exception as e:  # um produto ruim não derruba o lote
            print(f"  ! falhou: {e}")
            continue
        state.mark(p.uid, p.title, p.commission_rate, str(folder))
        notify.send_package(folder, (folder / "caption.txt").read_text(encoding="utf-8"))
        print(f"  ✓ {folder}")
    state.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
