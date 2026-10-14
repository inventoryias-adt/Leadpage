'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { createClaim, creditByCpf, lookupCpf, type CaixaState, type CpfLookup } from '@/app/actions/restaurant';
import { calculatePoints, formatPoints, parseMoneyToCents } from '@/lib/points';
import { applyPromos, promoActiveAt, promoBadge, type PromoLike } from '@/lib/promos';
import { formatCpf, isValidCpf, normalizePhone, onlyDigits } from '@/lib/br';
import { Icon } from './Icons';
import { PrintTicket } from './PrintTicket';
import { SubmitButton, maskPhoneInput } from './ui';

type Rule = { id: string; label: string; points: number };
/** Campanha vinda do servidor (datas em texto ISO). */
export type PromoData = Omit<PromoLike, 'startsAt' | 'endsAt'> & { id: string; startsAt: string | null; endsAt: string | null };

export function CaixaForm({ pointsPerReal, rules, promos = [], placeName }: { pointsPerReal: number; rules: Rule[]; promos?: PromoData[]; placeName: string }) {
  const [state, action] = useActionState<CaixaState, FormData>(createClaim, {});
  const [direct, directAction] = useActionState<CaixaState, FormData>(creditByCpf, {});
  const [cpf, setCpf] = useState('');
  const [lookup, setLookup] = useState<CpfLookup | 'loading' | null>(null);
  const [amount, setAmount] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState(''); // só sai no cupom impresso; não é enviado ao servidor
  const [copied, setCopied] = useState(false);

  // Prévia apenas visual — o servidor recalcula os pontos com as regras do banco.
  const promoList = useMemo(() => promos.map((p) => ({ ...p, startsAt: p.startsAt ? new Date(p.startsAt) : null, endsAt: p.endsAt ? new Date(p.endsAt) : null })), [promos]);
  const liveAll = promoList.filter((p) => promoActiveAt(p));
  const livePromos = liveAll.filter((p) => p.audience === 'ALL');
  const liveAudience = liveAll.filter((p) => p.audience !== 'ALL');
  const preview = useMemo(() => {
    const cents = amount.trim() ? parseMoneyToCents(amount) ?? 0 : 0;
    const extras = rules.filter((r) => checked.includes(r.id)).reduce((n, r) => n + r.points, 0);
    return applyPromos(calculatePoints(cents, pointsPerReal), cents, promoList.filter((p) => p.audience === 'ALL')).points + extras;
  }, [amount, checked, pointsPerReal, rules, promoList]);

  // Ao completar um CPF válido, vê se o cliente já tem conta (nome abreviado).
  useEffect(() => {
    const digits = onlyDigits(cpf);
    if (digits.length < 11) return setLookup(null);
    if (!isValidCpf(digits)) return setLookup({ status: 'invalid' });
    setLookup('loading');
    let alive = true;
    lookupCpf(digits).then((r) => alive && setLookup(r)).catch(() => alive && setLookup(null));
    return () => {
      alive = false;
    };
  }, [cpf]);
  const found = typeof lookup === 'object' && lookup?.status === 'found' ? lookup : null;
  const credited = direct.credited;

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const claim = state.claim;
  const router = useRouter();
  // Atualiza "Últimos lançamentos" depois que o QR Code já está na tela.
  useEffect(() => {
    if (claim) router.refresh();
  }, [claim, router]);

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
      {liveAudience.length > 0 && (
        <p className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900" role="status">
          <strong>Campanha por público:</strong> {liveAudience.map((p) => `${p.title} (${promoBadge(p)})`).join(' · ')}. O bônus entra sozinho quando o cliente ler o QR, se ele fizer parte do público.
        </p>
      )}
      {livePromos.length > 0 && (
        <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="status">
          <strong>Campanha valendo agora:</strong> {livePromos.map((p) => `${p.title} (${promoBadge(p)}${p.minAmountCents > 0 ? `, a partir de R$ ${(p.minAmountCents / 100).toFixed(2).replace('.', ',')}` : ''})`).join(' · ')}. Os pontos já saem com a campanha aplicada.
        </p>
      )}

      <form
        action={(fd) => {
          setCopied(false);
          action(fd);
        }}
        className="space-y-5"
      >
        <div className="glass-inset space-y-2 p-3">
          <label className="glass-label !mb-0" htmlFor="cpf">
            CPF do cliente <span className="font-normal text-slate-500">(opcional: lança os pontos direto na conta dele)</span>
          </label>
          <input id="cpf" name="cpf" inputMode="numeric" autoComplete="off" className="glass-input" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} />
          <div aria-live="polite" className="min-h-[1.25rem] text-sm">
            {lookup === 'loading' && <span className="text-slate-500">Procurando…</span>}
            {found && <span className="font-semibold text-emerald-700">✓ {found.name} já tem conta no Fidelize. Dá para lançar direto.</span>}
            {typeof lookup === 'object' && lookup?.status === 'new' && <span className="text-slate-600">Este CPF ainda não tem conta. Gere o QR Code e envie por WhatsApp para ele criar a conta e receber os pontos.</span>}
            {typeof lookup === 'object' && lookup?.status === 'invalid' && <span className="text-red-600">CPF inválido. Confira os números.</span>}
            {typeof lookup === 'object' && lookup?.status === 'limit' && <span className="text-red-600">Muitas consultas seguidas. Aguarde alguns minutos.</span>}
          </div>
        </div>

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

        <div>
          <label className="glass-label" htmlFor="print-name">
            Nome do cliente <span className="font-normal text-slate-500">(opcional, sai no cupom impresso)</span>
          </label>
          <input id="print-name" className="glass-input" maxLength={60} placeholder="Ex.: Maria Souza" value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="off" />
        </div>

        <p className="text-center">
          <span className="text-sm text-slate-500">Total a creditar: </span>
          <span className="text-3xl font-extrabold text-electric-600">{formatPoints(preview)} pts</span>
        </p>

        {(state.error || direct.error) && <p role="alert" className="glass-error">{direct.error ?? state.error}</p>}
        {found ? (
          <>
            <SubmitButton variant="lime" formAction={directAction} pendingText="Lançando…">Lançar na conta de {found.name}</SubmitButton>
            <SubmitButton variant="ghost" pendingText="Gerando…">Gerar QR Code em vez disso</SubmitButton>
          </>
        ) : (
          <SubmitButton variant="lime" pendingText="Gerando…">Gerar QR Code</SubmitButton>
        )}
        {claim && (
          <button
            type="button"
            className="link-inline w-full text-sm"
            onClick={() => {
              setAmount('');
              setChecked([]);
              setPhone('');
              setCustomerName('');
              setCpf('');
            }}
          >
            Limpar para novo lançamento
          </button>
        )}
      </form>

      {credited && (
        <div role="status" className="animate-fade-in mt-8 rounded-3xl bg-emerald-50 p-6 text-center">
          <p className="text-4xl">✓</p>
          <p className="mt-2 text-lg font-bold text-emerald-800">{formatPoints(credited.points)} pontos lançados para {credited.name}</p>
          <p className="text-sm text-emerald-700">{credited.description}</p>
          <p className="mt-2 text-sm text-slate-600">Saldo dele agora: <strong>{formatPoints(credited.balance)} pts</strong>. Ele recebeu um aviso no app.</p>
          <button type="button" className="glass-button-ghost mt-4" onClick={() => { setAmount(''); setChecked([]); setPhone(''); setCustomerName(''); setCpf(''); }}>Novo lançamento</button>
        </div>
      )}

      {claim && (
        <div className="animate-fade-in mt-8 flex flex-col items-center rounded-3xl bg-white p-6 shadow-inner">
          <QRCodeSVG value={claim.url} size={208} fgColor="#0F1F3D" level="M" marginSize={1} />
          <p className="mt-4 text-center text-lg font-bold text-primary">{formatPoints(claim.points)} pontos</p>
          <p className="text-center text-sm text-slate-500">{claim.description}</p>
          <p className="mt-1 text-center text-xs text-slate-400">
            Uso único · válido até {new Date(claim.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
          <p className="mt-3 text-center text-sm text-slate-500">Peça para o cliente escanear com a câmera do celular.</p>
          <div className="mt-4 grid w-full gap-2 sm:grid-cols-3">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="glass-button">Enviar por WhatsApp</a>
            <button type="button" onClick={() => window.print()} className="glass-button-ghost">
              <Icon name="receipt" size={16} /> Imprimir QR Code
            </button>
            <button type="button" onClick={copy} className="glass-button-ghost">{copied ? 'Link copiado ✓' : 'Copiar link'}</button>
          </div>
          <PrintTicket placeName={placeName} points={claim.points} amountCents={claim.amountCents} customerName={customerName.trim()} description={claim.description} url={claim.url} createdAt={claim.createdAt} expiresAt={claim.expiresAt} />
        </div>
      )}
    </div>
  );
}
