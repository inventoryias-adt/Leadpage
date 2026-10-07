/* Service worker mínimo: habilita a instalação do PWA e mostra uma tela offline amigável.
   Não faz cache de páginas: saldo e pontos precisam estar sempre atualizados. */
const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title><body style="font-family:system-ui;background:#eaf3ff;color:#1e3a8a;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;margin:0;padding:24px"><div><h1>Sem conexão</h1><p>Conecte-se à internet para ver seus pontos.</p><button onclick="location.reload()" style="padding:12px 24px;border:0;border-radius:12px;background:#2f6bff;color:#fff;font-weight:600">Tentar de novo</button></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    ),
  );
});
