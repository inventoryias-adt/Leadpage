import subprocess
from pathlib import Path

import pytest

from pipeline import media, muapi


class Resp:
    def __init__(self, status=200, data=None, content=b""):
        self.status_code, self._d, self.content = status, data or {}, content
        self.ok = status < 400
        self.text = str(data)

    def json(self):
        return self._d


class FakeHttp:
    def __init__(self, results):
        self.results, self.calls = list(results), []

    def post(self, url, **kw):
        self.calls.append(("POST", url, kw))
        return Resp(200, {"url": "https://cdn/img.jpg"}) if url.endswith("upload_file") else Resp(200, {"request_id": "r1"})

    def get(self, url, **kw):
        self.calls.append(("GET", url, kw))
        if "predictions" in url:
            return self.results.pop(0)
        return Resp(200, content=b"VIDEO")


def client(http):
    return muapi.MuapiClient("k", http=http, poll_interval=0)


def test_requires_key(monkeypatch):
    monkeypatch.delenv("MUAPI_API_KEY", raising=False)
    with pytest.raises(muapi.MuapiError):
        muapi.MuapiClient()


def test_image_to_video_flow(tmp_path, monkeypatch):
    monkeypatch.setattr(muapi.time, "sleep", lambda s: None)
    img = tmp_path / "a.jpg"
    img.write_bytes(b"x")
    http = FakeHttp([Resp(200, {"status": "processing"}), Resp(200, {"status": "completed", "outputs": ["https://cdn/v.mp4"]})])
    out = client(http).image_to_video(img, "p", "kling-v2.5-turbo-std-i2v", 5, tmp_path / "o.mp4")
    assert out.read_bytes() == b"VIDEO"
    submit = [c for c in http.calls if c[0] == "POST" and "kling" in c[1]][0]
    assert submit[1] == "https://api.muapi.ai/api/v1/kling-v2.5-turbo-std-i2v"
    assert submit[2]["json"] == {"prompt": "p", "image_url": "https://cdn/img.jpg", "duration": 5}
    assert submit[2]["headers"]["x-api-key"] == "k"


def test_failed_generation_raises(tmp_path, monkeypatch):
    monkeypatch.setattr(muapi.time, "sleep", lambda s: None)
    http = FakeHttp([Resp(200, {"status": "failed", "error": "nsfw"})])
    with pytest.raises(muapi.MuapiError, match="nsfw"):
        client(http).run("m", {})


def test_clip_segment_renders_vertical(tmp_path):
    clip = tmp_path / "c.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=640x640:rate=24:duration=2",
                    "-pix_fmt", "yuv420p", str(clip)], check=True)
    ov = tmp_path / "o.png"
    media.render_overlay("Achadinho!", 1080, 1920, "#FF5A1F", False).save(ov)
    out = tmp_path / "s.mp4"
    media._segment_from_clip(clip, ov, out, 3.0, 1080, 1920, 30)   # clipe de 2s, segmento de 3s (faz loop)
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height,duration", "-of", "csv=p=0", str(out)],
                           capture_output=True, text=True).stdout.strip()
    assert probe.startswith("1080,1920,")
