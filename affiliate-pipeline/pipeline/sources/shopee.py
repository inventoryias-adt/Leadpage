"""Shopee Afiliados – Open API (GraphQL).

Docs: https://affiliate.shopee.com.br  ->  Open API.
Assinatura: SHA256(AppId + Timestamp + Payload + Secret).
Campos usados: productOfferV2 (commissionRate, price, ratingStar, sales, imageUrl,
offerLink) e a mutation generateShortLink (link curto rastreável com subId).
"""
from __future__ import annotations

import hashlib
import json
import os
import time

import requests

from ..models import Product

PRODUCT_QUERY = """
query ($keyword: String, $page: Int, $limit: Int) {
  productOfferV2(keyword: $keyword, sortType: 5, page: $page, limit: $limit) {
    nodes {
      itemId productName shopName imageUrl
      priceMin priceMax commissionRate ratingStar sales
      productLink offerLink
    }
    pageInfo { hasNextPage }
  }
}
"""

SHORTLINK_MUTATION = """
mutation ($url: String!, $subIds: [String]) {
  generateShortLink(input: {originUrl: $url, subIds: $subIds}) { shortLink }
}
"""


def _rate(raw) -> float:
    """A API devolve a taxa como string ('0.2' ou '20'); normaliza para fração."""
    v = float(raw or 0)
    return v / 100 if v > 1 else v


class ShopeeClient:
    def __init__(self, endpoint: str, app_id: str | None = None, secret: str | None = None):
        self.endpoint = endpoint
        self.app_id = app_id or os.environ["SHOPEE_APP_ID"]
        self.secret = secret or os.environ["SHOPEE_SECRET"]

    def _post(self, query: str, variables: dict) -> dict:
        payload = json.dumps({"query": query, "variables": variables}, separators=(",", ":"))
        ts = str(int(time.time()))
        sig = hashlib.sha256(f"{self.app_id}{ts}{payload}{self.secret}".encode()).hexdigest()
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"SHA256 Credential={self.app_id}, Timestamp={ts}, Signature={sig}",
        }
        r = requests.post(self.endpoint, data=payload, headers=headers, timeout=30)
        r.raise_for_status()
        body = r.json()
        if body.get("errors"):
            raise RuntimeError(f"Shopee API: {body['errors']}")
        return body["data"]

    def short_link(self, url: str, sub_id: str) -> str:
        data = self._post(SHORTLINK_MUTATION, {"url": url, "subIds": [sub_id]})
        return data["generateShortLink"]["shortLink"]

    def search(self, keyword: str, page: int, limit: int) -> list[dict]:
        data = self._post(PRODUCT_QUERY, {"keyword": keyword, "page": page, "limit": limit})
        return data["productOfferV2"]["nodes"]


def parse_node(n: dict) -> Product:
    price = float(n.get("priceMin") or n.get("priceMax") or 0)
    return Product(
        platform="shopee",
        product_id=str(n["itemId"]),
        title=n["productName"],
        price=price,
        commission_rate=_rate(n.get("commissionRate")),
        image_urls=[n["imageUrl"]] if n.get("imageUrl") else [],
        affiliate_url=n.get("offerLink") or "",
        rating=float(n.get("ratingStar") or 0),
        sales=int(n.get("sales") or 0),
        shop_name=n.get("shopName") or "",
        extra={"productLink": n.get("productLink")},
    )


def fetch_candidates(cfg: dict, min_rate: float) -> list[Product]:
    """Busca por palavra-chave e já descarta o que está abaixo da comissão mínima
    *antes* de gastar chamadas de generateShortLink."""
    scfg = cfg["shopee"]
    client = ShopeeClient(scfg["endpoint"])
    out: list[Product] = []
    for kw in scfg["keywords"]:
        for page in range(1, scfg["pages_per_keyword"] + 1):
            for node in client.search(kw, page, scfg["page_size"]):
                p = parse_node(node)
                if p.commission_rate >= min_rate:
                    out.append(p)
    return out


def attach_short_links(products: list[Product], cfg: dict) -> None:
    client = ShopeeClient(cfg["shopee"]["endpoint"])
    for p in products:
        origin = p.extra.get("productLink") or p.affiliate_url
        p.affiliate_url = client.short_link(origin, cfg["shopee"]["sub_id"])
