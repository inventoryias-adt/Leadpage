import { addDaysKey, dayStartUtc, formatBookingWhen, hmOf, parseDateKey, weekdayOf } from './booking';
import { formatPhone } from './br';
import { formatBRL } from './points';

/** Períodos da agenda do dono. "dia" é o dia escolhido; os demais são calculados a partir dele. */
export const PERIODS = ['dia', 'semana', 'mes', 'mes-passado'] as const;
export type AgendaPeriod = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<AgendaPeriod, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês', 'mes-passado': 'Mês passado' };

const pad = (n: number) => String(n).padStart(2, '0');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const fmtDay = (key: string) => `${key.slice(8)}/${key.slice(5, 7)}`;

/** Primeiro e último dia (inclusive, AAAA-MM-DD) do período que contém `anchor`, mais um rótulo legível. */
export function periodRange(period: AgendaPeriod, anchor: string): { from: string; to: string; label: string } {
  const p = parseDateKey(anchor);
  if (!p) throw new Error('Data inválida.');
  if (period === 'dia') return { from: anchor, to: anchor, label: fmtDay(anchor) };
  if (period === 'semana') {
    const back = (weekdayOf(anchor) + 6) % 7; // segunda = 0
    const from = addDaysKey(anchor, -back);
    const to = addDaysKey(from, 6);
    return { from, to, label: `semana de ${fmtDay(from)} a ${fmtDay(to)}` };
  }
  const month = period === 'mes' ? p.m : p.m === 1 ? 12 : p.m - 1;
  const year = period === 'mes' || p.m !== 1 ? p.y : p.y - 1;
  const from = `${year}-${pad(month)}-01`;
  const to = addDaysKey(month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`, -1);
  return { from, to, label: `${MESES[month - 1]} de ${year}` };
}

/** Início (UTC) do primeiro dia e fim (UTC) do último dia, para consultar o banco. */
export const rangeBounds = (from: string, to: string) => ({ start: dayStartUtc(from), end: new Date(dayStartUtc(to).getTime() + 24 * 3_600_000) });

export type ExportRow = {
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  resourceName: string | null;
  status: string;
  priceCents: number;
  discountCents: number;
  partySize: number | null;
  note: string | null;
};

export const STATUS_PT: Record<string, string> = { PENDING: 'Aguardando', CONFIRMED: 'Confirmado', COMPLETED: 'Concluído', CANCELED: 'Cancelado', NO_SHOW: 'Faltou' };

const dayKeyOf = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
const hm = (d: Date) => {
  const [h, m] = hmOf(d).split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
};

/** Texto pronto para mandar pelo WhatsApp (ex.: para o profissional): agenda do período, dia a dia, sem os cancelados. */
export function whatsappText(rows: ExportRow[], opts: { who: string | null; label: string }): string {
  const live = rows.filter((r) => r.status !== 'CANCELED').sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const head = `Agenda${opts.who ? ` de ${opts.who}` : ''} · ${opts.label}`;
  if (live.length === 0) return `${head}\n\nNenhum agendamento neste período.`;
  const days = new Map<string, ExportRow[]>();
  for (const r of live) days.set(dayKeyOf(r.startsAt), [...(days.get(dayKeyOf(r.startsAt)) ?? []), r]);
  const blocks = [...days.values()].map((list) => {
    const lines = list.map((r) => {
      const extra = [!opts.who && r.resourceName ? `com ${r.resourceName}` : null, r.partySize ? `${r.partySize} pessoas` : null, r.status === 'PENDING' ? 'aguardando confirmação' : null, r.status === 'NO_SHOW' ? 'faltou' : null].filter(Boolean);
      return `• ${hm(r.startsAt)}–${hm(r.endsAt)} ${r.serviceName} — ${r.customerName} ${formatPhone(r.customerPhone)}${extra.length ? ` (${extra.join(', ')})` : ''}`;
    });
    return `${formatBookingWhen(list[0].startsAt).split(' às ')[0]}\n${lines.join('\n')}`;
  });
  return `${head}\n\n${blocks.join('\n\n')}\n\nTotal: ${live.length} ${live.length === 1 ? 'agendamento' : 'agendamentos'}.`;
}

/** Célula de CSV: aspas escapadas e protegida contra "injeção de fórmula" (=, +, -, @ no começo viram texto no Excel). */
export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Planilha (separador ";" e BOM UTF-8, o que o Excel em português abre direto). */
export function toCsv(rows: ExportRow[]): string {
  const head = ['Data', 'Início', 'Fim', 'Profissional', 'Serviço', 'Cliente', 'Telefone', 'Status', 'Valor', 'Desconto em pontos', 'A cobrar', 'Pessoas', 'Recado'];
  const lines = rows
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((r) =>
      [
        dayKeyOf(r.startsAt).split('-').reverse().join('/'),
        hmOf(r.startsAt),
        hmOf(r.endsAt),
        r.resourceName,
        r.serviceName,
        r.customerName,
        formatPhone(r.customerPhone),
        STATUS_PT[r.status] ?? r.status,
        r.priceCents > 0 ? formatBRL(r.priceCents) : '',
        r.discountCents > 0 ? formatBRL(r.discountCents) : '',
        r.priceCents > 0 ? formatBRL(r.priceCents - r.discountCents) : '',
        r.partySize,
        r.note,
      ]
        .map(csvCell)
        .join(';'),
    );
  return `﻿${[head.map(csvCell).join(';'), ...lines].join('\r\n')}\r\n`;
}
