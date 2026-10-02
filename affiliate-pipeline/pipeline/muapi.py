"""Cliente mínimo da MuAPI (a API por trás do open-generative-ai).

Fluxo (espelha open-generative-ai/src/lib/muapi.js):
  POST /api/v1/upload_file                       -> {url}
  POST /api/v1/<endpoint>        (x-api-key)     -> {request_id}
  GET  /api/v1/predictions/<id>/result           -> {status, outputs:[url]}
"""
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
                 poll_interval: float = 4.0, max_polls: int = 150):
        self.key = api_key or os.environ.get("MUAPI_API_KEY")
        if not self.key:
            raise MuapiError("MUAPI_API_KEY não definido")
        self.base, self.http = base_url.rstrip("/"), http
        self.poll_interval, self.max_polls = poll_interval, max_polls

    @property
    def _headers(self) -> dict:
        return {"x-api-key": self.key}

    def upload(self, path: Path) -> str:
        with open(path, "rb") as f:
            r = self.http.post(f"{self.base}/api/v1/upload_file", headers=self._headers,
                               files={"file": (Path(path).name, f)}, timeout=120)
        if not r.ok:
            raise MuapiError(f"upload {r.status_code}: {r.text[:120]}")
        d = r.json()
        url = d.get("url") or d.get("file_url") or (d.get("data") or {}).get("url")
        if not url:
            raise MuapiError("upload sem url na resposta")
        return url

    def run(self, endpoint: str, payload: dict) -> str:
        """Envia a tarefa, espera terminar e devolve a URL da saída."""
        r = self.http.post(f"{self.base}/api/v1/{endpoint}", headers={**self._headers, "Content-Type": "application/json"},
                           json=payload, timeout=60)
        if not r.ok:
            raise MuapiError(f"{endpoint} {r.status_code}: {r.text[:160]}")
        d = r.json()
        rid = d.get("request_id") or d.get("id")
        if not rid:
            return _output_url(d)
        for _ in range(self.max_polls):
            time.sleep(self.poll_interval)
            pr = self.http.get(f"{self.base}/api/v1/predictions/{rid}/result", headers=self._headers, timeout=60)
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

    def image_to_video(self, image_path: Path, prompt: str, model: str, duration: int | None,
                       out_path: Path) -> Path:
        payload = {"prompt": prompt, "image_url": self.upload(image_path)}
        if duration:
            payload["duration"] = duration
        url = self.run(model, payload)
        data = self.http.get(url, timeout=180)
        if not data.ok:
            raise MuapiError(f"download do clipe {data.status_code}")
        out_path.write_bytes(data.content)
        return out_path


def _output_url(res: dict) -> str:
    outs = res.get("outputs") or []
    url = (outs[0] if outs else None) or res.get("url") or (res.get("output") or {}).get("url")
    if not url:
        raise MuapiError(f"resposta sem saída: {str(res)[:120]}")
    return url
