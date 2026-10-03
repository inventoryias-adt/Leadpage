import json
import subprocess
from pathlib import Path

import pytest

from channel import images, llm, meta, research, script as scriptmod, state, youtube
from channel.config import load_config
from channel.run import build, slug


@pytest.fixture(autouse=True)
def _no_wait(monkeypatch):
    monkeypatch.setattr(images, "MIN_GAP", 0)
    monkeypatch.setattr(images.time, "sleep", lambda s: None)


class Resp:
    def __init__(self, data=None, status=200, content=b"", headers=None):
        self._d, self.status_code, self.content, self.headers = data or {}, status, content, headers or {}
        self.ok = status < 400
        self.text = str(data)

    def json(self):
        return self._d

    def raise_for_status(self):
        if not self.ok:
            raise RuntimeError(self.status_code)


def fake_script(n=12):
    return {"title": "A Queda de Constantinopla", "thumb_text": "O fim de um império", "summary": "Resumo curto.",
            "tags": ["história", "bizâncio"],
            "scenes": [{"narration": f"Esta é a cena número {i}. Aqui acontece algo importante na história.",
                        "chapter": ["Introdução", "O cerco", "A queda", "Depois"][i // 3] if i % 3 == 0 else None,
                        "commons_query": "Constantinople 1453", "ai_prompt": "walls of a medieval city"}
                       for i in range(n)]}


# ---------- fatos / roteiro ----------
def test_clean_text_cuts_references():
    txt = "Intro.\n== História ==\nCorpo.\n== Ver também ==\nlixo\n== Referências ==\nmais lixo"
    out = research.clean_text(txt, 1000)
    assert "Corpo" in out and "lixo" not in out


def test_fetch_article_falls_back_to_search():
    class Http:
        def __init__(self):
            self.calls = 0

        def get(self, url, **kw):
            p = kw["params"]
            if p.get("list") == "search":
                return Resp({"query": {"search": [{"title": "Real"}]}})
            if p["titles"] == "Errado":
                return Resp({"query": {"pages": {"-1": {"missing": ""}}}})
            return Resp({"query": {"pages": {"1": {"title": "Real", "extract": "Texto.", "fullurl": "https://w/Real"}}}})
    a = research.fetch_article("Errado", "pt", 1000, http=Http())
    assert a["title"] == "Real" and a["url"] == "https://w/Real"


def test_validate_rejects_short_and_fills_defaults():
    with pytest.raises(ValueError):
        scriptmod.validate({"title": "x", "thumb_text": "y", "summary": "z", "scenes": [{"narration": "a"}]})
    s = scriptmod.validate(fake_script())
    assert s["scenes"][0]["chapter"] == "Introdução"


def test_verify_and_fix_rewrites_only_flagged(monkeypatch):
    answers = iter([{"issues": [{"scene": 1, "problem": "data inventada"}, {"scene": 99, "problem": "fora"}]},
                    {"scenes": [{"scene": 1, "narration": "Texto corrigido."}]}])
    monkeypatch.setattr(llm, "complete_json", lambda *a, **k: next(answers))
    s = scriptmod.validate(fake_script())
    before = s["scenes"][2]["narration"]
    s, issues = scriptmod.verify_and_fix(s, {"text": "fonte"}, {"model_verify": "m"})
    assert len(issues) == 1 and s["scenes"][1]["narration"] == "Texto corrigido." and s["scenes"][2]["narration"] == before


def test_extract_json_with_noise():
    assert llm.extract_json('claro!\n```json\n{"a": 1}\n```') == {"a": 1}


# ---------- imagens ----------
@pytest.mark.parametrize("lic,ok", [("Public domain", True), ("PD-old-100", True), ("CC0", True), ("CC BY 4.0", True),
                                    ("CC BY-SA 4.0", False), ("CC BY-NC 2.0", False), ("Fair use", False), ("", False)])
def test_license_ok(lic, ok):
    assert images.license_ok(lic, ["public domain", "pd", "cc0", "cc by"]) is ok


def test_commons_search_filters_and_credits():
    cfg = load_config()
    page = lambda t, idx, w, lic: {"title": t, "index": idx, "imageinfo": [{
        "mime": "image/jpeg", "width": w, "height": 900, "url": "u", "thumburl": "thumb", "descriptionurl": "d",
        "extmetadata": {"LicenseShortName": {"value": lic}, "Artist": {"value": "<a>Fulano</a>"}}}]}
    data = {"query": {"pages": {"1": page("File:A.jpg", 1, 3000, "CC BY-SA 4.0"), "2": page("File:B.jpg", 2, 500, "CC0"),
                                "3": page("File:C.jpg", 3, 3000, "Public domain"), "4": page("File:D.jpg", 4, 3000, "CC0")}}}

    class Http:
        def get(self, *a, **k):
            return Resp(data)
    hit = images.commons_search("x", cfg, set(), Http())
    assert hit["title"] == "File:C.jpg" and hit["author"] == "Fulano"
    assert images.commons_search("x", cfg, {"File:C.jpg"}, Http())["title"] == "File:D.jpg"


# ---------- metadados ----------
def test_chapters_rules():
    sc = [{"chapter": "Intro"}, {"chapter": None}, {"chapter": "B"}, {"chapter": "C"}]
    assert meta.chapters(sc, [20, 20, 20, 20])[0].startswith("0:00 Intro")
    assert meta.chapters(sc, [20, 20, 5, 20]) == []          # C começa < 10 s depois de B, sobram 2 capítulos
    assert meta.chapters([{"chapter": None}] + sc[1:], [20] * 4) == []   # não começa em 0:00


def test_srt_timing_is_monotonic_and_covers_scenes():
    sc = [{"narration": "Primeira frase. Segunda frase um pouco mais longa."}, {"narration": "Outra cena."}]
    out = meta.srt(sc, [6.0, 3.0])
    assert out.count("-->") >= 3 and out.startswith("1\n00:00:00,000")
    assert "00:00:06,350 --> " in out                       # 2ª cena começa após 6 s + pausa


# ---------- YouTube ----------
def test_youtube_upload_flow(tmp_path):
    v = tmp_path / "v.mp4"
    v.write_bytes(b"123")
    t = tmp_path / "t.jpg"
    t.write_bytes(b"jpg")
    calls = []

    class Http:
        def post(self, url, **kw):
            calls.append(("POST", url, kw))
            if "oauth2" in url:
                return Resp({"access_token": "AT"})
            if "thumbnails" in url:
                return Resp({})
            return Resp({}, headers={"Location": "https://up/session"})

        def put(self, url, **kw):
            calls.append(("PUT", url, kw))
            return Resp({"id": "VID1"})
    md = {"title": "T", "description": "D", "tags": ["a"], "category_id": "27", "language": "pt-BR",
          "privacy": "private", "made_for_kids": False, "synthetic": True}
    vid = youtube.YouTube("c", "s", "r", http=Http()).upload(v, md, t)
    assert vid == "VID1"
    init = calls[1][2]["json"]
    assert init["status"] == {"privacyStatus": "private", "selfDeclaredMadeForKids": False, "containsSyntheticMedia": True}
    assert calls[1][2]["headers"]["Authorization"] == "Bearer AT"
    assert "videoId=VID1" in calls[3][1]


def test_state_next_topic(tmp_path):
    tp = tmp_path / "t.yaml"
    tp.write_text("- title: A\n  wiki: AA\n- B\n", encoding="utf-8")
    assert state.next_topic(str(tp), [])["wiki"] == "AA"
    assert state.next_topic(str(tp), [{"topic": "a"}]) == {"title": "B", "wiki": "B"}
    assert state.next_topic(str(tp), [{"topic": "a"}, {"topic": "b"}]) is None


def test_slug():
    assert slug("A Queda de Constantinopla!") == "a-queda-de-constantinopla"


# ---------- montagem completa offline ----------
def test_build_end_to_end_offline(tmp_path, monkeypatch):
    cfg = load_config()
    cfg["output_dir"] = str(tmp_path / "out")
    cfg["video"].update(width=640, height=360, fps=12)
    cfg["music_dir"] = str(tmp_path / "nomusic")
    art = {"title": "Fonte", "url": "https://pt.wikipedia.org/wiki/Fonte", "text": "texto de teste. " * 200}
    md = build({"title": "A Queda de Constantinopla", "wiki": "x"}, cfg, offline=True, article=art,
               script=scriptmod.validate(fake_script(9)))
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "csv=p=0",
                            str(md["video"])], capture_output=True, text=True).stdout
    assert "video,640,360" in probe and "audio" in probe
    assert md["thumbnail"].stat().st_size < 2_000_000
    saved = json.loads((md["dir"] / "metadata.json").read_text(encoding="utf-8"))
    assert saved["privacy"] == "private" and "Fonte principal" in saved["description"]
    assert "0:00 Introdução" in saved["description"]
    assert (md["dir"] / "subtitles.srt").exists()


# ---------- limite de taxa / reaproveitamento ----------
def test_polite_get_retries_on_429():
    seq = [Resp({}, status=429, headers={"Retry-After": "1"}), Resp({}, status=429), Resp({"ok": 1})]

    class Http:
        def get(self, *a, **k):
            return seq.pop(0)
    r = images.polite_get(Http(), "u")
    assert r.status_code == 200 and not seq


def test_scene_image_reuses_real_image_and_disables_ai_without_credit(tmp_path):
    from PIL import Image
    cfg = load_config()
    cfg["video"].update(width=64, height=36)
    cfg["images"]["ai_fallback"] = True          # o padrão é desligado; aqui testamos o caminho com IA
    real = tmp_path / "real.jpg"
    Image.new("RGB", (64, 36), (9, 9, 9)).save(real)
    calls = []

    class Broken:
        def text_to_image(self, *a, **k):
            calls.append(1)
            raise RuntimeError("402 INSUFFICIENT_CREDITS")

    class NoHit:
        def get(self, *a, **k):
            return Resp({"query": {"pages": {}}})
    ctx = {"used": set(), "pool": [{"path": real, "kind": "commons", "credit": "c"}], "ai_ok": True}
    sc = {"commons_query": "x", "ai_prompt": "y"}
    a = images.scene_image(sc, 1, cfg, tmp_path, ctx, Broken(), NoHit())
    b = images.scene_image(sc, 2, cfg, tmp_path, ctx, Broken(), NoHit())
    assert a["kind"] == b["kind"] == "reuse" and a["credit"] is None
    assert len(calls) == 1 and ctx["ai_ok"] is False        # a IA só é tentada uma vez sem crédito


def test_scene_image_card_when_nothing_available(tmp_path):
    cfg = load_config()
    cfg["video"].update(width=64, height=36)
    cfg["images"]["ai_fallback"] = False

    class NoHit:
        def get(self, *a, **k):
            return Resp({"query": {"pages": {}}})
    ctx = {"used": set(), "pool": [], "ai_ok": True}
    assert images.scene_image({"commons_query": "x", "ai_prompt": "y"}, 0, cfg, tmp_path, ctx, None, NoHit())["kind"] == "card"


def test_youtube_strips_secrets_and_flags_bad_format():
    ok = youtube.YouTube(" abc.apps.googleusercontent.com\n", "GOCSPX-" + "x" * 28 + " ", "1//tok\n")
    assert ok.cid == "abc.apps.googleusercontent.com" and ok.refresh == "1//tok" and ok.format_problems() == []
    bad = youtube.YouTube("123", "****abcd", "ya29.token").format_problems()
    assert len(bad) == 3 and not any("****" in b or "ya29.token" in b for b in bad)   # não vaza valores


# ---------- subir pacote existente ----------
def _make_package(tmp_path, topic="A Queda de Constantinopla"):
    d = tmp_path / "out" / slug(topic)
    d.mkdir(parents=True)
    (d / "video.mp4").write_bytes(b"v")
    (d / "thumbnail.jpg").write_bytes(b"t")
    (d / "metadata.json").write_text(json.dumps({
        "title": "T", "description": "D", "tags": ["a"], "category_id": "27", "language": "pt-BR", "privacy": "private",
        "made_for_kids": False, "synthetic": True, "seconds": 600}), encoding="utf-8")
    return d


def test_load_package_and_upload_only(tmp_path, monkeypatch):
    from channel import run
    cfg = load_config()
    cfg["output_dir"] = str(tmp_path / "out")
    cfg["published_path"] = str(tmp_path / "pub.json")
    _make_package(tmp_path)
    md = run.load_package(cfg)                              # único pacote: não precisa de --topic
    assert md["title"] == "T" and md["video"].name == "video.mp4" and md["topic"] == "T"

    seen = {}

    class FakeYT:
        def __init__(self):
            pass

        def format_problems(self):
            return []

        def upload(self, video, meta, thumb):
            seen["video"] = video.name
            return "VID9"
    monkeypatch.setattr(run, "YouTube", FakeYT)
    for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"):
        monkeypatch.setenv(k, "x")
    import argparse
    assert run.upload_only(cfg, argparse.Namespace(topic=None, no_upload=False)) == 0
    assert seen["video"] == "video.mp4"
    assert state.load_published(cfg["published_path"])[0]["youtube_id"] == "VID9"


def test_upload_only_no_upload_and_missing(tmp_path):
    from channel import run
    import argparse
    cfg = load_config()
    cfg["output_dir"] = str(tmp_path / "out")
    cfg["published_path"] = str(tmp_path / "pub.json")
    with pytest.raises(SystemExit):                          # nenhuma pasta
        run.load_package(cfg)
    d = _make_package(tmp_path)
    assert run.upload_only(cfg, argparse.Namespace(topic=None, no_upload=True)) == 0
    assert state.load_published(cfg["published_path"]) == []     # nada registrado
    (d / "thumbnail.jpg").unlink()
    with pytest.raises(SystemExit):
        run.load_package(cfg)


def test_clean_secret_removes_paste_leftovers():
    assert youtube.clean_secret("GOCSPX-abc_DEF-123&scope=&grant_type=authorization_code") == "GOCSPX-abc_DEF-123"
    assert youtube.clean_secret('  "1//04-abc\ndef"  ') == "1//04-abcdef"
    yt = youtube.YouTube("id.apps.googleusercontent.com", "GOCSPX-" + "x" * 28 + "&scope=", "1//tok\nmore")
    assert yt.secret == "GOCSPX-" + "x" * 28 and yt.refresh == "1//tokmore"
    problems = yt.format_problems()
    assert any("YT_CLIENT_SECRET" in p for p in problems) and any("YT_REFRESH_TOKEN" in p for p in problems)
    assert not any("YT_CLIENT_ID" in p for p in problems)
    assert not any("xxxx" in p or "tokmore" in p for p in problems)          # não vaza valores


# ---------- orientação por tema / fonte curta / variáveis de ambiente ----------
def test_note_goes_into_the_prompt(monkeypatch):
    seen = {}
    monkeypatch.setattr(llm, "complete_json", lambda prompt, *a, **k: seen.setdefault("p", prompt) and fake_script(12))
    cfg = load_config()
    scriptmod.generate("O Êxodo do Egito", {"title": "Livro do Êxodo", "text": "texto"}, cfg, note="Atribua ao texto bíblico.")
    assert "ORIENTAÇÃO DO CANAL" in seen["p"] and "Atribua ao texto bíblico." in seen["p"]
    seen.clear()
    scriptmod.generate("X", {"title": "t", "text": "texto"}, cfg)
    assert "ORIENTAÇÃO DO CANAL" not in seen["p"]


def test_topics_yaml_biblical_topics_carry_the_note():
    cfg = load_config()
    first = state.next_topic(cfg["topics_path"], [])
    assert first["title"] == "O Êxodo do Egito" and first["wiki"] == "Livro do Êxodo"
    assert "atribuindo" in first["note"] and "Não invente" in first["note"]
    ordered = [t["title"] for t in __import__("yaml").safe_load(open(cfg["topics_path"], encoding="utf-8"))]
    assert "A Queda de Constantinopla" in ordered and len(set(ordered)) == len(ordered)


def test_short_source_is_refused(tmp_path):
    cfg = load_config()
    cfg["output_dir"] = str(tmp_path / "out")
    with pytest.raises(SystemExit, match="Fonte curta demais"):
        build({"title": "T", "wiki": "x"}, cfg, offline=True, article={"title": "A", "url": "u", "text": "curto"},
              script=scriptmod.validate(fake_script(9)))


def test_main_reads_workflow_env_vars(monkeypatch, tmp_path):
    from channel import run
    captured = {}

    def fake_build(topic, cfg, **k):
        captured["topic"] = topic
        raise SystemExit("para aqui")
    monkeypatch.setattr(run, "build", fake_build)
    monkeypatch.setenv("CH_TOPIC", 'O "Êxodo" do Egito')               # aspas não quebram nada (sem shell)
    monkeypatch.setenv("CH_WIKI", "Livro do Êxodo")
    monkeypatch.setenv("CH_NOTE", "Seja respeitoso.")
    monkeypatch.setenv("CH_UPLOAD", "false")
    for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    with pytest.raises(SystemExit, match="para aqui"):
        run.main([])
    assert captured["topic"] == {"title": 'O "Êxodo" do Egito', "wiki": "Livro do Êxodo", "note": "Seja respeitoso."}


# ---------- ritmo da voz ----------
def test_pauses_depend_on_punctuation():
    from channel import voice
    assert voice.split_sentences("Um. Dois? Três... Quatro!") == ["Um.", "Dois?", "Três...", "Quatro!"]
    assert [voice.pause_after(s) for s in ["a.", "a?", "a!", "a...", "a…"]] == [0.35, 0.45, 0.40, 0.55, 0.55]
    assert voice.pause_after("a.", {"sentence": 0.9}) == 0.9


def test_synthesize_paced_joins_sentences_with_pauses(tmp_path, monkeypatch):
    from channel import voice

    def fake_save(sentences, paths, voice_name, rate, pitch):
        for s, p in zip(sentences, paths):          # 1 s de silêncio por frase
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                            "-t", "1", "-c:a", "libmp3lame", str(p)], check=True)
    monkeypatch.setattr(voice, "_save_sentences", fake_save)
    out = tmp_path / "v.mp3"
    secs = voice.synthesize_paced("Um. Dois? Três!", out, "v", "+0%", pauses={"sentence": 0.5, "question": 1.0})
    assert 3.0 + 0.5 + 1.0 - 0.3 < secs < 3.0 + 0.5 + 1.0 + 0.3      # 3 frases + pausa após "." e "?" (sem pausa no fim)
    assert not list(tmp_path.glob("v_s*.mp3"))                        # temporários removidos


# ---------- movimento ----------
def test_shot_frames_split_scene_exactly():
    from channel import render
    assert sum(render.shot_frames(11.0, 12, 5.0)) == 132 and len(render.shot_frames(11.0, 12, 5.0)) == 2
    assert len(render.shot_frames(3.0, 12, 5.0)) == 1
    assert len(render.shot_frames(60, 12, 5.0)) == 4                  # limite de 4 planos


def test_scene_clip_multishot_with_chapter_card(tmp_path):
    from PIL import Image
    from channel import render
    Image.new("RGB", (800, 500), (120, 80, 40)).save(tmp_path / "i.jpg")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "11",
                    "-c:a", "libmp3lame", str(tmp_path / "a.mp3")], check=True)
    card = render.chapter_card("O cerco", 640, 360, tmp_path / "c.png")
    render.scene_clip(tmp_path / "i.jpg", tmp_path / "a.mp3", 10.65, 2, tmp_path / "o.mp4", 640, 360, 12,
                      {"shots": True, "shot_seconds": 5.0, "grain": True}, card)
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height,nb_frames",
                          "-of", "csv=p=0", str(tmp_path / "o.mp4")], capture_output=True, text=True).stdout.strip()
    assert out == "640,360,132"


# ---------- re-renderizar sem chamar o Claude ----------
def test_rerender_uses_saved_script_and_never_calls_llm(tmp_path, monkeypatch):
    from channel import run
    cfg = load_config()
    cfg["output_dir"] = str(tmp_path / "out")
    cfg["published_path"] = str(tmp_path / "pub.json")
    d = _make_package(tmp_path, "O Êxodo do Egito")
    meta_file = d / "metadata.json"
    md = json.loads(meta_file.read_text(encoding="utf-8"))
    md.update(topic="O Êxodo do Egito", source="https://pt.wikipedia.org/wiki/Livro_do_%C3%8Axodo")
    meta_file.write_text(json.dumps(md, ensure_ascii=False), encoding="utf-8")
    (d / "script.json").write_text(json.dumps(fake_script(9), ensure_ascii=False), encoding="utf-8")
    seen = {}

    def fake_build(topic, cfg, **k):
        seen.update(topic=topic, script=k.get("script"))
        return {"video": d / "video.mp4", "seconds": 600, "dir": d, "title": "T"}
    monkeypatch.setattr(run, "build", fake_build)
    monkeypatch.setattr(llm, "complete", lambda *a, **k: (_ for _ in ()).throw(AssertionError("não deveria chamar o Claude")))
    import argparse
    assert run.rerender(cfg, argparse.Namespace(topic=None, no_upload=True)) == 0
    assert seen["topic"]["wiki"] == "Livro do Êxodo" and seen["topic"]["title"] == "O Êxodo do Egito"
    assert len(seen["script"]["scenes"]) == 9


# ---------- acervo do tema / variedade de imagens ----------
def _png_bytes(color=(10, 20, 30)):
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (64, 36), color).save(buf, format="PNG")
    return buf.getvalue()


def _info_page(title, lic="Public domain", w=2000, h=1200, cats="", idx=1):
    return {"title": title, "index": idx, "imageinfo": [{
        "mime": "image/jpeg", "width": w, "height": h, "url": f"https://up/{title}", "thumburl": f"https://up/{title}",
        "descriptionurl": f"https://c/{title}",
        "extmetadata": {"LicenseShortName": {"value": lic}, "Artist": {"value": "Doré"},
                        "Categories": {"value": cats}, "ObjectName": {"value": title}}}]}


class Router:
    """Simula Wikipédia + Commons + download de imagens."""
    def __init__(self):
        self.searches = []

    def get(self, url, **kw):
        p = kw.get("params", {})
        if url.startswith("https://up/"):
            return Resp(content=_png_bytes())
        if "wikipedia.org" in url and p.get("prop") == "langlinks":
            return Resp({"query": {"pages": {"1": {"langlinks": [{"lang": "en", "*": "The Exodus"}]}}}})
        if "wikipedia.org" in url and p.get("prop") == "images":
            names = ["Ficheiro:Moses Dore.jpg", "Ficheiro:Flag of Egypt.png", "Ficheiro:Red Sea map.png", "Ficheiro:Logo.svg"]
            return Resp({"query": {"pages": {"1": {"images": [{"title": n} for n in names]}}}})
        if "commons" in url and p.get("titles"):
            pages = {}
            for i, t in enumerate(p["titles"].split("|")):
                lic = "CC BY-SA 4.0" if "map" in t.lower() else "Public domain"
                cats = {"File:Moses Dore.jpg": "Moses|Exodus", "File:Red Sea map.png": "Red Sea"}.get(t, "")
                pages[str(i)] = _info_page(t, lic=lic, cats=cats, idx=i)
            return Resp({"query": {"pages": pages}})
        if "commons" in url and p.get("generator") == "search":
            self.searches.append(p["gsrsearch"])
            if "Pharaoh" in p["gsrsearch"]:
                return Resp({"query": {"pages": {"9": _info_page("File:Pharaoh Ramesses.jpg", cats="Pharaoh")}}})
            return Resp({"query": {"pages": {}}})
        raise AssertionError(f"chamada inesperada {url} {p}")


def test_fallback_queries_and_tokens():
    assert images.fallback_queries("Mehmed II young sultan") == ["Mehmed II young sultan", "Mehmed II young", "Mehmed II"]
    assert images.fallback_queries("Exodus") == ["Exodus"]
    assert {"exodus", "israelites", "moises"} <= images.tokens("The Exodus of the Israelites, Moisés")


def test_build_pool_collects_article_images_filters_and_counts(monkeypatch):
    cfg = load_config()
    pool, stats = images.build_pool("Livro do Êxodo", "O Êxodo do Egito", cfg, Router())
    titles = {c["title"] for c in pool}
    assert "File:Moses Dore.jpg" in titles                      # prefixo "Ficheiro:" normalizado para "File:"
    assert not any("Flag" in t or "Logo" in t for t in titles)  # ícones/bandeiras fora
    assert "File:Red Sea map.png" not in titles and stats["licenca_sa"] >= 1   # CC BY-SA recusada e contada
    assert stats["acervo"] == len(pool)


def test_scenes_pick_distinct_images_by_affinity_and_never_repeat_first(tmp_path):
    cfg = load_config()
    cfg["video"].update(width=64, height=36)
    cfg["images"]["ai_fallback"] = False
    names = {"File:Moses Dore.jpg": "Moses Exodus staff", "File:Red Sea crossing.jpg": "Red Sea crossing waters",
             "File:Pharaoh Ramesses.jpg": "Pharaoh Egypt court"}
    cands = [{"title": t, "url": f"https://up/{t}", "author": "A", "license": "PD", "page": "p", "tokens": images.tokens(d)}
             for t, d in names.items()]
    ctx = {"used": set(), "pool": [], "ai_ok": True, "candidates": cands}
    scenes = [{"commons_queries": ["Red Sea crossing"], "narration": "Eles atravessam o mar"},
              {"commons_queries": ["Pharaoh Egypt"], "narration": "O faraó"},
              {"commons_queries": ["Moses staff"], "narration": "Moisés ergue o cajado"}]
    got = [images.scene_image(s, i, cfg, tmp_path, ctx, None, Router()) for i, s in enumerate(scenes)]
    assert [g["kind"] for g in got] == ["commons"] * 3
    assert [g["credit"].split(" — ")[0] for g in got] == ["Red Sea crossing.jpg", "Pharaoh Ramesses.jpg", "Moses Dore.jpg"]


def test_progressive_search_finds_with_shorter_query(tmp_path):
    cfg = load_config()
    cfg["video"].update(width=64, height=36)
    cfg["images"]["ai_fallback"] = False
    router = Router()
    ctx = {"used": set(), "pool": [], "ai_ok": True, "candidates": []}
    info = images.scene_image({"commons_queries": ["Pharaoh Ramesses chariot battle"], "narration": "x"}, 0, cfg, tmp_path,
                              ctx, None, router)
    assert info["kind"] == "commons" and "Pharaoh" in info["credit"]
    assert len(router.searches) == 1                       # a primeira consulta já achou (contém 'Pharaoh')


def test_reuse_rotates_least_used_instead_of_repeating_same_images(tmp_path):
    from PIL import Image
    cfg = load_config()
    cfg["video"].update(width=64, height=36)
    cfg["images"]["ai_fallback"] = False
    pool = []
    for k in range(3):
        p = tmp_path / f"real{k}.jpg"
        Image.new("RGB", (64, 36), (k, k, k)).save(p)
        pool.append({"path": p, "kind": "commons", "credit": f"c{k}"})
    ctx = {"used": set(), "pool": pool, "ai_ok": True, "candidates": [], "uses": {str(p["path"]): 1 for p in pool},
           "last": {str(p["path"]): i for i, p in enumerate(pool)}}

    class NoHit:
        def get(self, *a, **k):
            return Resp({"query": {"pages": {}}})
    srcs = []
    for i in range(6):
        info = images.scene_image({"commons_queries": ["zzz"], "narration": "x"}, 10 + i, cfg, tmp_path, ctx, None, NoHit())
        assert info["kind"] == "reuse"
        srcs.append(max(ctx["last"], key=ctx["last"].get))
    assert len(set(srcs)) == 3 and srcs[:3] == srcs[3:]    # gira entre as 3, sem martelar sempre as mesmas


def test_validate_builds_commons_queries():
    s = scriptmod.validate(fake_script(9))
    assert s["scenes"][0]["commons_queries"] == ["Constantinople 1453"] and s["scenes"][0]["commons_query"] == "Constantinople 1453"
    raw = fake_script(9)
    raw["scenes"][1]["commons_queries"] = ["specific one", "", "general"]
    assert scriptmod.validate(raw)["scenes"][1]["commons_queries"] == ["specific one", "general"]
