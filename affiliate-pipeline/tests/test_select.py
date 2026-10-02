from pipeline.models import Product
from pipeline.select import passes, pick
from pipeline.sources.shopee import _rate, parse_node
from pipeline.sources.tiktok_csv import load

CFG = dict(min_commission_rate=0.20, min_rating=4.5, min_sales=200, min_price=20, max_price=400, daily_limit=2)


def prod(pid="1", rate=0.25, **kw):
    base = dict(platform="shopee", product_id=pid, title="x", price=50.0, commission_rate=rate,
                image_urls=["a.png"], affiliate_url="https://s", rating=4.8, sales=1000)
    base.update(kw)
    return Product(**base)


def test_exactly_20_percent_passes_and_below_fails():
    assert passes(prod(rate=0.20), CFG)
    assert not passes(prod(rate=0.199), CFG)


def test_other_filters():
    assert not passes(prod(rating=4.0), CFG)
    assert not passes(prod(sales=10), CFG)
    assert not passes(prod(price=10), CFG)
    assert not passes(prod(image_urls=[]), CFG)


def test_pick_dedups_skips_seen_and_limits():
    cands = [prod("1", 0.30), prod("1", 0.30), prod("2", 0.25), prod("3", 0.40), prod("4", 0.10)]
    got = pick(cands, CFG, lambda uid: uid == "shopee:3")
    assert [p.product_id for p in got] == ["1", "2"]


def test_rate_normalisation():
    assert _rate("0.2") == 0.2
    assert _rate("20") == 0.2
    assert _rate(None) == 0.0


def test_parse_node():
    p = parse_node({"itemId": 9, "productName": "n", "priceMin": "10.5", "commissionRate": "0.21",
                    "imageUrl": "u", "offerLink": "o", "ratingStar": "4.9", "sales": 5})
    assert (p.product_id, p.price, p.commission_rate, p.sales) == ("9", 10.5, 0.21, 5)


def test_tiktok_csv(tmp_path):
    f = tmp_path / "t.csv"
    f.write_text("product_id,title,price,commission_rate,image_urls,affiliate_url,rating,sales,shop_name\n"
                 '7,Prod,"R$ 39,90",25%,a.png|b.png,https://vm.tiktok.com/x,4.8,500,Loja\n', encoding="utf-8")
    [p] = load(str(f))
    assert (p.price, p.commission_rate, p.image_urls, p.platform) == (39.9, 0.25, ["a.png", "b.png"], "tiktok_shop")
