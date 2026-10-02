"""Filtro (>=20% de comissão etc.) e ranking dos produtos candidatos."""
from __future__ import annotations

import math

from .models import Product


def passes(p: Product, cfg: dict) -> bool:
    return (
        p.commission_rate >= cfg["min_commission_rate"]
        and p.rating >= cfg["min_rating"]
        and p.sales >= cfg["min_sales"]
        and cfg["min_price"] <= p.price <= cfg["max_price"]
        and bool(p.image_urls)
        and bool(p.affiliate_url)
    )


def score(p: Product) -> float:
    # ganho por venda × prova social × qualidade
    return p.commission_value * math.log10(max(p.sales, 10)) * (p.rating / 5)


def pick(candidates: list[Product], cfg: dict, is_seen) -> list[Product]:
    unique: dict[str, Product] = {}
    for p in candidates:
        if passes(p, cfg) and not is_seen(p.uid):
            unique.setdefault(p.uid, p)
    ranked = sorted(unique.values(), key=score, reverse=True)
    return ranked[: cfg["daily_limit"]]
