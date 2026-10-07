'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useActionState, useMemo, useState } from 'react';
import { createClaim, type CaixaState } from '@/app/actions/restaurant';
import { calculatePoints, formatPoints, parseMoneyToCents } from '@/lib/points';
import { normalizePhone } from '@/lib/br';
import { SubmitButton, maskPhoneInput } from './ui';

type Rule = { id: string; label: string; points: number };

export function CaixaForm({ pointsPerReal, rules }: { pointsPerReal: number; rules: Rule[] }) {
  const [state, action] = useActionState<CaixaState, FormData>(createClaim, {});
  const [amount, setAmount] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);

  // Prévia apenas visual — o servidor recalcula os pontos com as regras do banco.
  const preview = useMemo(() => {
    const cents = amount.trim() ? parseMoneyToCents(amount) ?? 0 : 0;
    return calculatePoints(cents, pointsPerReal, rules.filter((r) => checked.includes(r.id)));
  }, [amount, checked, pointsPerReal, rules]);

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const claim = state.claim;

  const whatsappHref = useMemo(() => {
    if (!claim) return '';
    const msg = `Você ganhou ${formatPoints(claim.points)} pontos! 🎉 Toque para resgatar na sua carteira: ${claim.url}`;
    const p = claim.phone ? normalizePhone(claim.phone) : null;
    return `https://wa.me/${p ? `55${p}` : ''}?text=${encodeURIComponent(msg)}`;
  }, [claim]);

  async function copy() {
    if (!claim) return;
    try {
      await navigator.clipboard.writeText(claim.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível (http / navegador antigo) — o link segue visível na tela */
    }
  }

  return (
    <div className="glass-panel p-6 sm:p-8">
      <h1 className="mb-6 text-center text-2xl font-bold text-primary">Gerar pontos</h1>

      <form
        action={(fd) => {
          setCopied(false);
          action(fd);
        }}
        className="space-y-5"
      >
        <div>
          <label className="glass-label" htmlFor="amount">Valor da conta (R$)</label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            className="glass-input text-2xl font-semibold"
            placeholder="0,00"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {rules.length > 0 && (
          <fieldset className="glass-inset space-y-1 p-3">
            <legend className="px-1 text-sm font-semibold text-primary">Interações extras</legend>
            {rules.map((r) => (
              <label key={r.id} className="flex min-h-12 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-electric-600/10">
                <input
                  type="checkbox"
                  name="interaction"
                  value={r.id}
                  checked={checked.includes(r.id)}
                  onChange={() => toggle(r.id)}
                  className="h-5 w-5 shrink-0 rounded accent-electric-500"
                />
                <span className="text-sm text-slate-700">
                  {r.label} <span className="font-semibold text-electric-600">(+{formatPoints(r.points)} pts)</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <div>
          <label className="glass-label" htmlFor="phone">
            WhatsApp do cliente <span className="font-normal text-slate-500">(opcional, para enviar o link)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            className="glass-input"
            placeholder="(11) 91234-5678"
            value={phone}
            onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
          />
        </div>

        <p className="text-center">
          <span className="text-sm text-slate-500">Total a creditar: </span>
          <span className="text-3xl font-extrabold text-electric-600">{formatPoints(preview)} pts</span>
        </p>

        {state.error && <p role="alert" className="glass-error">{state.error}</p>}
        <SubmitButton pendingText="Gerando…">Gerar QR Code</SubmitButton>
        {claim && (
          <button
            type="button"
            className="link-inline w-full text-sm"
            onClick={() => {
              setAmount('');
              setChecked([]);
              setPhone('');
            }}
          >
            Limpar para novo lançamento
          </button>
        )}
      </form>

      {claim && (
        <div className="animate-fade-in mt-8 flex flex-col items-center rounded-3xl bg-white p-6 shadow-inner">
          <QRCodeSVG value={claim.url} size={208} fgColor="#1E3A8A" level="M" marginSize={1} />
          <p className="mt-4 text-center text-lg font-bold text-primary">{formatPoints(claim.points)} pontos</p>
          <p className="text-center text-sm text-slate-500">{claim.description}</p>
          <p className="mt-1 text-center text-xs text-slate-400">
            Uso único · válido até {new Date(claim.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
          <p className="mt-3 text-center text-sm text-slate-500">Peça para o cliente escanear com a câmera do celular.</p>
          <div className="mt-4 grid w-full gap-2 sm:grid-cols-2">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="glass-button">Enviar por WhatsApp</a>
            <button type="button" onClick={copy} className="glass-button-ghost">{copied ? 'Link copiado ✓' : 'Copiar link'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
