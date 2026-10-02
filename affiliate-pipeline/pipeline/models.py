from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass
class Product:
    platform: str                 # "shopee" | "tiktok_shop"
    product_id: str
    title: str
    price: float
    commission_rate: float        # 0.20 == 20%
    image_urls: list[str]
    affiliate_url: str            # link curto de afiliado (o que vai na legenda/bio)
    rating: float = 0.0
    sales: int = 0
    shop_name: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def uid(self) -> str:
        return f"{self.platform}:{self.product_id}"

    @property
    def commission_value(self) -> float:
        return round(self.price * self.commission_rate, 2)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["uid"] = self.uid
        d["commission_value"] = self.commission_value
        return d
