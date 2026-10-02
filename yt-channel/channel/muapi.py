"""Cliente mínimo da MuAPI (API do open-generative-ai): upload, texto→imagem e polling."""
from __future__ import annotations

import os
import time
from pathlib import Path

import requests

BASE_URL = "https://api.muapi.ai"
SUCCESS = {"completed", "succeeded", "success"}
FAILURE = {"failed", "error", "cancelled", "canceled"}


class MuapiError(RuntimeError):
    pass


class MuapiClient:
    def __init__(self, api_key: str | None = None, base_url: str = BASE_URL, http=requests,
                 poll_interval: float = 3.0, max_polls: int = 100):
        self.key = api_key or os.environ.get("MUAPI_API_KEY")
        if not self.key:
            raise MuapiError("MUAPI_API_KEY não definido")
        self.base, self.http = base_url.rstrip("/"), http
        self.poll_interval, self.max_polls = poll_interval, max_polls

    def run(self, endpoint: str, payload: dict) -> str:
        h = {"x-api-key": self.key, "Content-Type": "application/json"}
        r = self.http.post(f"{self.base}/api/v1/{endpoint}", headers=h, json=payload, timeout=60)
        if not r.ok:
            raise MuapiError(f"{endpoint} {r.status_code}: {r.text[:160]}")
        d = r.json()
        rid = d.get("request_id") or d.get("id")
        if not rid:
            return _output_url(d)
        for _ in range(self.max_polls):
            time.sleep(self.poll_interval)
            pr = self.http.get(f"{self.base}/api/v1/predictions/{rid}/result", headers=h, timeout=60)
            if pr.status_code >= 500:
                continue
            if not pr.ok:
                raise MuapiError(f"poll {pr.status_code}: {pr.text[:120]}")
            res = pr.json()
            status = (res.get("status") or "").lower()
            if status in SUCCESS:
                return _output_url(res)
            if status in FAILURE:
                raise MuapiError(f"geração falhou: {res.get('error') or res.get('message') or res}")
        raise MuapiError(f"timeout aguardando {rid}")

    def text_to_image(self, prompt: str, model: str, out_path: Path, width: int = 1280, height: int = 720) -> Path:
        url = self.run(_endpoint(model), {"prompt": prompt, "width": width, "height": height, "num_images": 1})
        data = self.http.get(url, timeout=120)
        if not data.ok:
            raise MuapiError(f"download da imagem {data.status_code}")
        out_path.write_bytes(data.content)
        return out_path


def _endpoint(model_id: str) -> str:
    # ids do catálogo que diferem do endpoint (de open-generative-ai/packages/studio/src/models.js)
    return {"flux-schnell": "flux-schnell-image", "flux-dev": "flux-dev-image"}.get(model_id, model_id)


def _output_url(res: dict) -> str:
    outs = res.get("outputs") or []
    url = (outs[0] if outs else None) or res.get("url") or (res.get("output") or {}).get("url")
    if not url:
        raise MuapiError(f"resposta sem saída: {str(res)[:120]}")
    return url
