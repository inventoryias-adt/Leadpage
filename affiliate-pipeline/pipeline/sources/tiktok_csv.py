"""TikTok Shop: sem API pública de afiliados, então a fonte é um CSV.

Colunas: product_id,title,price,commission_rate,image_urls,affiliate_url[,rating,sales,shop_name]
- commission_rate aceita 0.25 ou 25 ou "25%"
- image_urls separadas por "|"
"""
from __future__ import annotations

import csv
from pathlib import Path

from ..models import Product


def _rate(raw: str) -> float:
    raw = (raw or "0").strip().replace("%", "").replace(",", ".")
    v = float(raw)
    return v / 100 if v > 1 else v


def _num(raw: str) -> float:
    return float((raw or "0").replace(",", ".").replace("R$", "").strip() or 0)


def load(path: str) -> list[Product]:
    p = Path(path)
    if not p.exists():
        return []
    out: list[Product] = []
    with open(p, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            out.append(
                Product(
                    platform="tiktok_shop",
                    product_id=row["product_id"].strip(),
                    title=row["title"].strip(),
                    price=_num(row["price"]),
                    commission_rate=_rate(row["commission_rate"]),
                    image_urls=[u for u in row.get("image_urls", "").split("|") if u.strip()],
                    affiliate_url=row["affiliate_url"].strip(),
                    rating=_num(row.get("rating", "") or "5"),
                    sales=int(_num(row.get("sales", "") or "0")),
                    shop_name=(row.get("shop_name") or "").strip(),
                )
            )
    return out
