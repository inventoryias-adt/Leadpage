"""Produtos fictícios + imagens geradas localmente, para testar o fluxo offline."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

from ..models import Product

SAMPLES = [
    ("m1", "Fone Bluetooth Sem Fio com Cancelamento de Ruído", 79.9, 0.25, 4.8, 5400, (40, 120, 220)),
    ("m2", "Organizador de Gaveta Modular 12 Peças", 34.9, 0.22, 4.7, 1900, (60, 170, 110)),
    ("m3", "Luminária LED Recarregável de Mesa", 59.9, 0.12, 4.9, 8000, (230, 170, 40)),   # <20%: deve cair
    ("m4", "Garrafa Térmica Inox 1L", 49.9, 0.30, 4.4, 3000, (170, 70, 160)),             # nota baixa: cai
]


def load(tmp_dir: Path) -> list[Product]:
    tmp_dir.mkdir(parents=True, exist_ok=True)
    out = []
    for pid, title, price, rate, rating, sales, color in SAMPLES:
        img = Image.new("RGB", (800, 800), color)
        d = ImageDraw.Draw(img)
        d.ellipse((150, 150, 650, 650), fill=(255, 255, 255))
        path = tmp_dir / f"{pid}.png"
        img.save(path)
        out.append(Product("shopee", pid, title, price, rate, [str(path)],
                           f"https://s.shopee.com.br/mock{pid}", rating, sales, "Loja Teste"))
    return out
