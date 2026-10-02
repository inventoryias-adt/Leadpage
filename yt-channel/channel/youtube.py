"""Upload na YouTube Data API v3 (resumable), sempre privado por padrão."""
from __future__ import annotations

import os
from pathlib import Path

import requests

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
THUMB_URL = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set"


class YouTubeError(RuntimeError):
    pass


class YouTube:
    def __init__(self, client_id=None, client_secret=None, refresh_token=None, http=requests):
        self.cid = client_id or os.environ["YT_CLIENT_ID"]
        self.secret = client_secret or os.environ["YT_CLIENT_SECRET"]
        self.refresh = refresh_token or os.environ["YT_REFRESH_TOKEN"]
        self.http = http

    def access_token(self) -> str:
        r = self.http.post(TOKEN_URL, data={"client_id": self.cid, "client_secret": self.secret,
                                            "refresh_token": self.refresh, "grant_type": "refresh_token"}, timeout=30)
        if not r.ok:
            raise YouTubeError(f"token {r.status_code}: {r.text[:200]}")
        return r.json()["access_token"]

    def upload(self, video: Path, meta: dict, thumb: Path | None = None) -> str:
        tok = self.access_token()
        auth = {"Authorization": f"Bearer {tok}"}
        body = {
            "snippet": {"title": meta["title"], "description": meta["description"], "tags": meta["tags"],
                        "categoryId": meta["category_id"], "defaultLanguage": meta["language"],
                        "defaultAudioLanguage": meta["language"]},
            "status": {"privacyStatus": meta["privacy"], "selfDeclaredMadeForKids": meta["made_for_kids"],
                       "containsSyntheticMedia": meta["synthetic"]},
        }
        init = self.http.post(f"{UPLOAD_URL}?uploadType=resumable&part=snippet,status", json=body, timeout=60, headers={
            **auth, "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(video.stat().st_size)})
        if not init.ok:
            raise YouTubeError(f"início do upload {init.status_code}: {init.text[:300]}")
        location = init.headers["Location"]
        with open(video, "rb") as f:
            up = self.http.put(location, data=f, headers={"Content-Type": "video/mp4"}, timeout=3600)
        if not up.ok:
            raise YouTubeError(f"upload {up.status_code}: {up.text[:300]}")
        vid = up.json()["id"]
        if thumb:
            tr = self.http.post(f"{THUMB_URL}?videoId={vid}&uploadType=media", data=thumb.read_bytes(), timeout=120,
                                headers={**auth, "Content-Type": "image/jpeg"})
            if not tr.ok:  # canal sem verificação por telefone não aceita miniatura via API
                print(f"  ! miniatura não enviada ({tr.status_code}): suba manualmente no Studio")
        return vid
