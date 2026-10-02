import json
import subprocess
from pathlib import Path

import pytest

from channel import images, llm, meta, research, script as scriptmod, state, youtube
from channel.config import load_config
from channel.run import build, slug


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
    art = {"title": "Fonte", "url": "https://pt.wikipedia.org/wiki/Fonte", "text": "texto"}
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
