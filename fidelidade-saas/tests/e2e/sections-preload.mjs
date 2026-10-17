// A página do lugar (cliente) agora deixa Ações, Campanhas e Desafios fechados até a pessoa tocar. Para os e2e antigos continuarem
// vendo o conteúdo, cada navegador de teste já começa com as três seções abertas (como se a pessoa tivesse deixado assim).
// O e2e54 testa o comportamento fechado: ele define FZ_SECTIONS=closed antes de abrir o navegador.
import { chromium } from 'playwright-core';
const orig = chromium.launch.bind(chromium);
const open = () => { try { for (const id of ['acoes', 'promocoes', 'desafios']) localStorage.setItem(`fz_sec_${id}`, '1'); } catch { /* sem armazenamento */ } };
chromium.launch = async (...a) => {
  const b = await orig(...a);
  const nc = b.newContext.bind(b);
  b.newContext = async (...x) => {
    const c = await nc(...x);
    if (process.env.FZ_SECTIONS !== 'closed') await c.addInitScript(open);
    return c;
  };
  return b;
};
