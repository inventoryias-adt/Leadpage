"""Roteiro + legenda. Usa Claude quando há ANTHROPIC_API_KEY; senão, template
baseado só em dados reais do produto (nunca inventa benefício)."""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass

from .models import Product


@dataclass
class Copy:
    hook: str
    bullets: list[str]
    cta: str
    caption: str
    hashtags: list[str]

    def segments(self, price_line: str) -> list[dict]:
        """Cenas do vídeo: texto na tela (+ o que é falado)."""
        segs = [{"text": self.hook, "spoken": self.hook}]
        segs += [{"text": b, "spoken": b} for b in self.bullets]
        segs.append({"text": f"{price_line}\n{self.cta}", "spoken": f"{price_line}. {self.cta}", "price": True})
        return segs


def brl(v: float) -> str:
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _short_title(title: str, n: int = 60) -> str:
    title = re.sub(r"\s+", " ", title).strip()
    return title if len(title) <= n else title[: n - 1].rsplit(" ", 1)[0] + "…"


def fallback_copy(p: Product, cfg: dict) -> Copy:
    bullets = []
    if p.rating:
        bullets.append(f"Nota {p.rating:.1f} dos clientes")
    if p.sales:
        bullets.append(f"Mais de {p.sales:,} vendidos".replace(",", "."))
    bullets = bullets[:2] or ["Olha esse achadinho"]
    return Copy(
        hook="Achadinho que vale a pena!",
        bullets=bullets,
        cta="Link na bio pra garantir",
        caption=f"{_short_title(p.title)} por {brl(p.price)}",
        hashtags=cfg["copy"]["niche_hashtags"],
    )


PROMPT = """Você escreve roteiros curtos de vídeo vertical (TikTok/Shopee Vídeo) em português do Brasil
para afiliados. Use SOMENTE os dados do produto abaixo. NÃO invente especificações, resultados,
descontos, depoimentos nem promessas de saúde/ganho. Tom: natural, animado, sem exagero.

Produto: {title}
Preço: {price}
Nota: {rating} | Vendidos: {sales} | Loja: {shop}

Responda APENAS com JSON:
{{"hook": "gancho de até 8 palavras",
  "bullets": ["2 ou 3 frases de até 7 palavras, baseadas no nome/dados do produto"],
  "cta": "chamada de até 6 palavras mandando para o link na bio",
  "caption": "legenda de 1-2 linhas",
  "hashtags": ["#..", "#..", "#.."]}}"""


def generate(p: Product, cfg: dict) -> Copy:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return fallback_copy(p, cfg)
    try:
        import anthropic

        client = anthropic.Anthropic()
        msg = client.messages.create(
            model=cfg["copy"]["model"],
            max_tokens=600,
            messages=[{
                "role": "user",
                "content": PROMPT.format(
                    title=p.title, price=brl(p.price), rating=p.rating or "n/d",
                    sales=p.sales or "n/d", shop=p.shop_name or "n/d",
                ),
            }],
        )
        raw = msg.content[0].text
        data = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
        return Copy(
            hook=data["hook"].strip(),
            bullets=[b.strip() for b in data["bullets"]][:3],
            cta=data["cta"].strip(),
            caption=data["caption"].strip(),
            hashtags=[h if h.startswith("#") else f"#{h}" for h in data["hashtags"]][:6],
        )
    except Exception as e:  # rede, JSON inválido, cota… nunca derruba o lote
        print(f"  ! copy via Claude falhou ({e}); usando template")
        return fallback_copy(p, cfg)


def full_caption(copy: Copy, p: Product, cfg: dict) -> str:
    tags = " ".join(dict.fromkeys(copy.hashtags + cfg["copy"]["niche_hashtags"]))
    return (
        f"{copy.caption}\n\n"
        f"💰 {brl(p.price)}\n"
        f"🛒 {p.affiliate_url}\n\n"
        f"{cfg['copy']['disclosure']}\n{tags}"
    )
