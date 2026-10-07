'use client';

import { useEffect } from 'react';

/** Valores que continuam ativos: só o que serve ao gerenciador de senhas do login. */
const KEEP = new Set(['current-password', 'new-password', 'username', 'one-time-code']);
const SKIP_TYPES = new Set(['hidden', 'checkbox', 'radio', 'file', 'submit', 'button', 'range', 'color']);

function apply(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((el) => {
    if (el instanceof HTMLInputElement && SKIP_TYPES.has(el.type)) return;
    const current = el.getAttribute('autocomplete');
    if (current && KEEP.has(current)) return;
    if (el instanceof HTMLInputElement && el.type === 'password') return; // o navegador decide (gerenciador de senhas)
    if (current !== 'off') el.setAttribute('autocomplete', 'off');
    // Impede que extensões de senha/preenchimento sugiram histórico nos campos comuns.
    el.setAttribute('data-lpignore', 'true');
    el.setAttribute('data-1p-ignore', 'true');
    el.setAttribute('data-form-type', 'other');
  });
  root.querySelectorAll('form').forEach((f) => f.getAttribute('autocomplete') !== 'off' && f.setAttribute('autocomplete', 'off'));
}

/**
 * Ajuste geral dos campos de texto: sem o histórico de digitação do navegador (a lista de sugestões que aparece ao
 * clicar no campo). Vale para qualquer tela, inclusive janelas que abrem depois. Senhas e o e-mail do login ficam como estão.
 */
export function NoAutofill() {
  useEffect(() => {
    apply(document);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => n instanceof HTMLElement && apply(n));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
