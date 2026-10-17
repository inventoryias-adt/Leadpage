'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { createClaim, creditByCpf, lookupCpf, type CaixaState, type CpfLookup } from '@/app/actions/restaurant';
import { calculatePoints, formatPoints, parseMoneyToCents } from '@/lib/points';
import { applyPromos, promoActiveAt, promoBadge, type PromoLike } from '@/lib/promos';
import { looksLikeAccountCode, normalizeAccountCode } from '@/lib/account-code';
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
  const { base, extras, preview } = useMemo(() => {
    const cents = amount.trim() ? parseMoneyToCents(amount) ?? 0 : 0;
    const extras = rules.filter((r) => checked.includes(r.id)).reduce((n, r) => n + r.points, 0);
    const base = applyPromos(calculatePoints(cents, pointsPerReal), cents, promoList.filter((p) => p.audience === 'ALL')).points;
    return { base, extras, preview: base + extras };
  }, [amount, checked, pointsPerReal, rules, promoList]);

  // Ao completar um CPF válido (ou um ID da conta), vê se o cliente já tem conta (nome abreviado).
  useEffect(() => {
    const byId = looksLikeAccountCode(cpf);
    const digits = onlyDigits(cpf);
    if (byId) {
      if (!normalizeAccountCode(cpf)) return setLookup(null); // ainda digitando o ID
    } else {
      if (digits.length < 11) return setLookup(null);
      if (!isValidCpf(digits)) return setLookup({ status: 'invalid' });
    }
    setLookup('loading');
    let alive = true;
    lookupCpf(byId ? cpf : digits).then((r) => alive && setLookup(r)).catch(() => alive && setLookup(null));
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

  const clear = () => {
    setAmount('');
    setChecked([]);
    setPhone('');
    setCustomerName('');
    setCpf('');
  };

  return (
    <div className="space-y-4">
      {liveAudience.length > 0 && (
        <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900" role="status">
          <strong>Campanha por público:</strong> {liveAudience.map((p) => `${p.title} (${promoBadge(p)})`).join(' · ')}. O bônus entra sozinho quando o cliente ler o QR, se ele fizer parte do público.
        </p>
      )}
      {livePromos.length > 0 && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="status">
          <strong>Campanha valendo agora:</strong> {livePromos.map((p) => `${p.title} (${promoBadge(p)}${p.minAmountCents > 0 ? `, a partir de R$ ${(p.minAmountCents / 100).toFixed(2).replace('.', ',')}` : ''})`).join(' · ')}. Os pontos já saem com a campanha aplicada.
        </p>
      )}

      <form
        action={(fd) => {
          setCopied(false);
          action(fd);
        }}
        className="grid items-start gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
      >
        <section className="glass-panel space-y-5 p-5 sm:p-6" data-testid="caixa-lancar">
          <h1 className="text-xl font-bold text-primary">Lançar pontos</h1>

          <div>
            <label className="glass-label" htmlFor="amount">Valor da conta</label>
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              className="glass-input text-2xl font-semibold"
              placeholder="R$ 0,00"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="glass-label" htmlFor="cpf">
              CPF ou ID da conta do cliente <span className="font-normal text-slate-500">(opcional: lança os pontos direto na conta dele)</span>
            </label>
            <input id="cpf" name="cpf" autoComplete="off" className="glass-input" placeholder="000.000.000-00 ou FZ-7K3Q9X" value={cpf} onChange={(e) => setCpf(looksLikeAccountCode(e.target.value) ? e.target.value.toUpperCase().slice(0, 12) : formatCpf(e.target.value))} />
            <div aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm">
              {lookup === 'loading' && <span className="text-slate-500">Procurando…</span>}
              {found && <span className="inline-flex items-center gap-2 font-semibold text-emerald-700"><Icon name="check" size={18} /> Conta encontrada: <b className="text-primary">{found.name}</b>. Dá para lançar direto.</span>}
              {typeof lookup === 'object' && lookup?.status === 'new' && <span className="text-slate-600">Este CPF ainda não tem conta. Gere o QR Code e envie por WhatsApp para ele criar a conta e receber os pontos.</span>}
              {typeof lookup === 'object' && lookup?.status === 'invalid' && <span className="text-red-600">CPF inválido. Confira os números.</span>}
              {typeof lookup === 'object' && lookup?.status === 'noid' && <span className="text-red-600">Nenhuma conta com este ID. Confira o código com o cliente.</span>}
              {typeof lookup === 'object' && lookup?.status === 'limit' && <span className="text-red-600">Muitas consultas seguidas. Aguarde alguns minutos.</span>}
            </div>
          </div>

          {rules.length > 0 && (
            <fieldset>
              <legend className="glass-label">Interações</legend>
              <div className="space-y-2">
                {rules.map((r) => (
                  <label key={r.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-3 transition-colors ${checked.includes(r.id) ? 'border-[#0f1f3d] bg-[#f3f6fd]' : 'border-slate-200 bg-white hover:bg-[#f3f6fd]'}`}>
                    <input
                      type="checkbox"
                      name="interaction"
                      value={r.id}
                      checked={checked.includes(r.id)}
                      onChange={() => toggle(r.id)}
                      className="h-5 w-5 shrink-0 rounded accent-[#0f1f3d]"
                    />
                    <span className="min-w-0 flex-1 text-sm text-slate-700">{r.label}</span>
                    <span className="chip-lima shrink-0">+{formatPoints(r.points)} pts</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-baseline justify-between gap-3" data-testid="caixa-total">
              <span className="text-sm text-slate-500">
                {extras > 0 ? `${formatPoints(base)} da compra + ${formatPoints(extras)} de interações` : 'Total a creditar'}
              </span>
              <b className="text-2xl font-extrabold text-primary">{formatPoints(preview)} pontos</b>
            </div>

            {(state.error || direct.error) && <p role="alert" className="glass-error">{direct.error ?? state.error}</p>}
            {found ? (
              <>
                <SubmitButton variant="lime" formAction={directAction} pendingText="Lançando…" data-testid="lancar-direto">Lançar {formatPoints(preview)} pontos para {found.name.split(' ')[0]}</SubmitButton>
                <SubmitButton variant="ghost" pendingText="Gerando…">Gerar QR Code em vez disso</SubmitButton>
              </>
            ) : (
              <SubmitButton variant="lime" pendingText="Gerando…">Gerar QR Code</SubmitButton>
            )}
            {claim && (
              <button type="button" className="link-inline w-full text-sm" onClick={clear}>
                Limpar para novo lançamento
              </button>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="glass-panel p-5 text-center sm:p-6" data-testid="caixa-qr">
            <h2 className="text-left text-base font-bold text-primary">Cliente sem conta?</h2>
            <div className="mx-auto my-4 inline-block rounded-2xl border border-slate-200 bg-white p-2.5">
              {claim ? (
                <QRCodeSVG value={claim.url} size={176} fgColor="#0F1F3D" level="M" marginSize={1} />
              ) : (
                <div className="flex h-[176px] w-[176px] flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 text-xs text-slate-400">
                  <Icon name="qr" size={44} className="text-slate-300" />
                  O QR Code aparece aqui depois de gerar
                </div>
              )}
            </div>
            {claim ? (
              <>
                <p className="text-lg font-bold text-primary">{formatPoints(claim.points)} pontos</p>
                <p className="text-sm text-slate-500">{claim.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  QR Code de uso único, válido até {new Date(claim.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
                <p className="mt-2 text-sm text-slate-500">Peça para o cliente escanear com a câmera do celular.</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">QR Code de uso único, válido por 24 horas</p>
            )}
            <div className="mt-4 space-y-3 text-left">
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
            </div>
          </section>

          {claim && (
            <section className="glass-panel animate-fade-in space-y-2 p-4" data-testid="caixa-acoes">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="glass-button-ghost"><Icon name="whatsapp" size={18} /> Enviar por WhatsApp</a>
              <button type="button" onClick={copy} className="glass-button-ghost"><Icon name="copy" size={18} /> {copied ? 'Link copiado ✓' : 'Copiar link'}</button>
              <button type="button" onClick={() => window.print()} className="glass-button-ghost">
                <Icon name="receipt" size={18} /> Imprimir QR Code (80 mm)
              </button>
              <PrintTicket placeName={placeName} points={claim.points} amountCents={claim.amountCents} customerName={customerName.trim()} description={claim.description} url={claim.url} createdAt={claim.createdAt} expiresAt={claim.expiresAt} />
            </section>
          )}
        </div>
      </form>

      {credited && (
        <div role="status" className="animate-fade-in rounded-3xl bg-emerald-50 p-6 text-center">
          <p className="text-4xl">✓</p>
          <p className="mt-2 text-lg font-bold text-emerald-800">{formatPoints(credited.points)} pontos lançados para {credited.name}</p>
          <p className="text-sm text-emerald-700">{credited.description}</p>
          <p className="mt-2 text-sm text-slate-600">Saldo dele agora: <strong>{formatPoints(credited.balance)} pts</strong>. Ele recebeu um aviso no app.</p>
          <button type="button" className="glass-button-ghost mt-4" onClick={clear}>Novo lançamento</button>
        </div>
      )}
    </div>
  );
}
