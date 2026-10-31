// Espera a página terminar de carregar (rede ociosa) depois de cada navegação, antes de o teste mexer nela, e dá mais tempo a cada ação
// (o servidor de desenvolvimento compila cada rota na primeira visita). Quando um teste falha, guarda um print de cada aba.
import { chromium } from 'playwright-core';
const orig = chromium.launch.bind(chromium);
// Pronta = rede ociosa (no máximo 8 s de espera) e React hidratado (no máximo 15 s).
const settle = async (page) => {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  // O React marca o documento quando termina de hidratar: antes disso um clique ou um campo preenchido se perde (aconteceu no CI, sob carga).
  await page.waitForFunction(() => Object.keys(document).some((k) => k.startsWith('__reactContainer')), null, { timeout: 15000 }).catch(() => {});
};
const TRANSIENT = /ERR_CONNECTION_(REFUSED|RESET|CLOSED|TIMED_OUT)|ERR_EMPTY_RESPONSE|ERR_NETWORK_CHANGED/;
const pages = [];
const patch = (page) => {
  if (page.__hydratePatched) return page;
  page.__hydratePatched = true;
  pages.push(page);
  for (const name of ['goto', 'waitForURL', 'reload']) {
    const f = page[name].bind(page);
    page[name] = async (...a) => {
      let r;
      let slowTried = false;
      for (let i = 0; ; i++) {
        try {
          r = await f(...a);
          break;
        } catch (e) {
          // O servidor de desenvolvimento do CI às vezes demora mais de 60 s para compilar uma rota: a segunda tentativa já a encontra compilada.
          if (name === 'goto' && e?.name === 'TimeoutError' && !slowTried) {
            slowTried = true;
            console.error(`(navegação lenta: tentando de novo ${a[0]})`);
            continue;
          }
          // O servidor de desenvolvimento do CI se reinicia sozinho de vez em quando (memória) e recusa conexões por alguns segundos.
          if ((name === 'goto' || name === 'reload') && TRANSIENT.test(String(e?.message)) && i < 8) {
            console.error(`(servidor indisponível: nova tentativa ${i + 1} de ${name === 'goto' ? a[0] : 'recarregar'})`);
            await new Promise((ok) => setTimeout(ok, 4000));
            continue;
          }
          throw e;
        }
      }
      await settle(page);
      return r;
    };
  }
  return page;
};
chromium.launch = async (...a) => {
  const b = await orig(...a);
  const nc = b.newContext.bind(b);
  b.newContext = async (...x) => {
    const c = await nc(...x);
    c.setDefaultTimeout(60000); // o modo dev compila cada rota na primeira visita: dá folga
    const np = c.newPage.bind(c);
    c.newPage = async (...y) => patch(await np(...y));
    return c;
  };
  const np = b.newPage.bind(b);
  b.newPage = async (...x) => { const p = patch(await np(...x)); p.setDefaultTimeout(60000); return p; };
  return b;
};

// Quando um teste falha, guarda um print de cada aba e mostra os avisos da tela: no CI isso vira o artefato de depuração.
const onFail = async (err) => {
  console.error(err);
  let i = 0;
  for (const p of pages) {
    try {
      if (p.isClosed()) continue;
      console.error(`--- aba ${i} em ${p.url()}`);
      console.error('avisos na tela:', (await p.locator('[role=alert],[role=status]').allTextContents()).join(' | '));
      await p.screenshot({ path: `falha-${process.argv[1].split('/').pop().replace('.mjs', '')}-${i}.png`, fullPage: true });
    } catch { /* aba fechada */ }
    i++;
  }
  process.exit(1);
};
process.on('uncaughtException', onFail);
process.on('unhandledRejection', onFail);
