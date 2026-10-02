"""Rode UMA vez no seu computador para obter o refresh token do YouTube.

Uso:  python scripts/get_refresh_token.py <CLIENT_ID> <CLIENT_SECRET>
Abre uma URL do Google; ao autorizar, o código volta para http://127.0.0.1:8765 e a troca é feita aqui.
"""
import sys
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

import requests

SCOPE = "https://www.googleapis.com/auth/youtube.upload"
REDIRECT = "http://127.0.0.1:8765"


def main(cid: str, secret: str) -> None:
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": cid, "redirect_uri": REDIRECT, "response_type": "code", "scope": SCOPE,
        "access_type": "offline", "prompt": "consent"})
    got: dict = {}

    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            got.update(urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query))
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("Autorizado! Pode fechar esta aba e voltar ao terminal.".encode())

        def log_message(self, *a):
            pass

    print("Abrindo o navegador. Se não abrir, acesse:\n" + url)
    webbrowser.open(url)
    srv = HTTPServer(("127.0.0.1", 8765), H)
    while "code" not in got and "error" not in got:
        srv.handle_request()
    if "error" in got:
        sys.exit(f"Erro: {got['error']}")
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "code": got["code"][0], "client_id": cid, "client_secret": secret,
        "redirect_uri": REDIRECT, "grant_type": "authorization_code"}, timeout=30)
    r.raise_for_status()
    rt = r.json().get("refresh_token")
    if not rt:
        sys.exit("O Google não devolveu refresh_token. Revogue o acesso em myaccount.google.com/permissions e repita.")
    print("\nREFRESH TOKEN (guarde como secret YT_REFRESH_TOKEN; não compartilhe):\n" + rt)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
