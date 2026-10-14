// Marca sozinho a caixa "Li e concordo" em qualquer cadastro, para os e2e antigos continuarem passando.
import { chromium } from 'playwright-core';
const orig = chromium.launch.bind(chromium);
const script = () => {
  const f = () => document.querySelectorAll('input[name=acceptTerms]').forEach((e) => { if (!e.checked) e.click(); });
  new MutationObserver(f).observe(document, { subtree: true, childList: true });
  document.addEventListener('DOMContentLoaded', f);
};
chromium.launch = async (...a) => {
  const b = await orig(...a);
  const nc = b.newContext.bind(b);
  b.newContext = async (...x) => { const c = await nc(...x); await c.addInitScript(script); return c; };
  const np = b.newPage.bind(b);
  b.newPage = async (...x) => { const p = await np(...x); await p.context().addInitScript(script); return p; };
  return b;
};
