// Espera a página terminar de carregar (rede ociosa) depois de cada navegação, antes de o teste mexer nela.
// Em produção o HTML aparece antes de o React "ligar" os botões; um clique nesse intervalo se perde. Um usuário real não é tão rápido.
import { chromium } from 'playwright-core';
const orig = chromium.launch.bind(chromium);
// Pronta = rede ociosa e os controles da tela já foram hidratados pelo React.
const settle = async (page) => {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // Cada botão, formulário e campo que o React controla ganha uma chave __reactProps… quando é hidratado (a hidratação de cada ilha é independente).
  await page
    .waitForFunction(
      () => [...document.querySelectorAll('button, form, input, select, textarea')].every((el) => Object.keys(el).some((k) => k.startsWith('__reactProps'))),
      null,
      { timeout: 15000 },
    )
    .catch(() => {});
};
const pages = [];
const patch = (page) => {
  if (page.__hydratePatched) return page;
  page.__hydratePatched = true;
  pages.push(page);
  for (const name of ['goto', 'waitForURL', 'reload']) {
    const f = page[name].bind(page);
    page[name] = async (...a) => { const r = await f(...a); await settle(page); return r; };
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
