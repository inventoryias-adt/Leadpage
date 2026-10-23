import Link from 'next/link';
import { deleteFinanceEntry, endFinanceEntry, payCommissionAction, undoCommissionAction } from '@/app/actions/finance';
import { EmptyState } from '@/components/EmptyState';
import { CommissionPctForm, FinanceEntryForm } from '@/components/FinanceForms';
import { SubmitButton } from '@/components/ui';
import { todayKey } from '@/lib/booking';
import { commissionLabel, currentMonth, isMonthKey, monthLabel, monthShort, shiftMonth } from '@/lib/finance';
import { monthReport, trend } from '@/lib/finance-db';
import { formatBRL } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Financeiro' };
export const dynamic = 'force-dynamic';

const day = (key: string) => `${key.slice(8)}/${key.slice(5, 7)}`;

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const now = currentMonth();
  const month = isMonthKey(sp.mes) && sp.mes <= now ? sp.mes : now;
  const [r, months] = await Promise.all([monthReport(restaurant.id, month), trend(restaurant.id, month, 6)]);
  const result = r.incomeTotal - r.expenseTotal;
  const peak = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const sources: [string, number, string][] = [
    ['Agenda', r.income.agenda.cents, `${r.income.agenda.n} ${r.income.agenda.n === 1 ? 'atendimento concluído' : 'atendimentos concluídos'}`],
    ['Pedidos', r.income.pedidos.cents, `${r.income.pedidos.n} ${r.income.pedidos.n === 1 ? 'pedido retirado' : 'pedidos retirados'}`],
    ['Caixa', r.income.caixa.cents, `${r.income.caixa.n} ${r.income.caixa.n === 1 ? 'lançamento' : 'lançamentos'} de compras`],
    ['Lançadas por você', r.income.manual, 'entradas e clube de assinatura'],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">Financeiro</h1>
          <p className="text-sm text-slate-600">Quanto entrou, quanto saiu e o que sobrou, mês a mês.</p>
        </div>
        <a href={`/dashboard/exportar/financeiro?mes=${month}`} download className="glass-button-ghost btn-sm !w-auto px-4" data-testid="finance-csv">Baixar planilha (CSV)</a>
      </header>

      <nav className="glass-panel-sm flex items-center justify-between !rounded-2xl px-3 py-2" aria-label="Mês">
        <Link href={`/dashboard/financeiro?mes=${prev}`} className="px-3 py-1 text-xl font-bold text-electric-600" aria-label="Mês anterior" data-testid="month-prev">‹</Link>
        <p className="font-bold capitalize text-slate-800" data-testid="month-label">{monthLabel(month)}</p>
        {month < now ? <Link href={`/dashboard/financeiro?mes=${next}`} className="px-3 py-1 text-xl font-bold text-electric-600" aria-label="Próximo mês" data-testid="month-next">›</Link> : <span className="px-3 py-1 text-xl text-slate-300" aria-hidden>›</span>}
      </nav>

      <section className="grid grid-cols-3 gap-2 sm:gap-3" data-testid="finance-kpis">
        {[
          ['Entradas', r.incomeTotal, 'text-emerald-700', 'kpi-in'],
          ['Saídas', r.expenseTotal, 'text-rose-700', 'kpi-out'],
          ['Resultado', result, result >= 0 ? 'text-primary' : 'text-rose-700', 'kpi-result'],
        ].map(([label, cents, tone, id]) => (
          <div key={id as string} className="glass-panel-sm !rounded-2xl p-3 sm:p-4" data-testid={id as string}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label as string}</p>
            <p className={`mt-1 text-lg font-extrabold sm:text-2xl ${tone}`}>{formatBRL(cents as number)}</p>
          </div>
        ))}
      </section>

      <section className="glass-panel !rounded-[22px] p-4 sm:p-5" aria-labelledby="fluxo">
        <h2 id="fluxo" className="font-bold text-primary">Fluxo de caixa · últimos 6 meses</h2>
        <div className="mt-4 grid grid-cols-6 gap-2" data-testid="finance-chart">
          {months.map((m) => (
            <Link key={m.month} href={`/dashboard/financeiro?mes=${m.month}`} className={`flex flex-col items-center gap-1 rounded-xl p-1 ${m.month === month ? 'bg-slate-100' : ''}`} aria-label={`${monthLabel(m.month)}: entradas ${formatBRL(m.income)}, saídas ${formatBRL(m.expense)}`}>
              <div className="flex h-28 w-full items-end justify-center gap-1">
                <div className="w-3 rounded-t bg-emerald-500 sm:w-5" style={{ height: `${Math.max(2, (m.income / peak) * 100)}%` }} />
                <div className="w-3 rounded-t bg-rose-400 sm:w-5" style={{ height: `${Math.max(2, (m.expense / peak) * 100)}%` }} />
              </div>
              <span className="text-[11px] font-semibold capitalize text-slate-600">{monthShort(m.month)}</span>
            </Link>
          ))}
        </div>
        <p className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-500"><span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Entradas</span><span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-400" /> Saídas</span></p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="glass-panel !rounded-[22px] p-4 sm:p-5" data-testid="finance-sources">
          <h2 className="font-bold text-primary">De onde veio</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {sources.map(([name, cents, hint]) => (
              <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                <span><span className="block font-semibold text-slate-800">{name}</span><span className="text-xs text-slate-500">{hint}</span></span>
                <b className="text-slate-900">{formatBRL(cents)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass-panel !rounded-[22px] p-4 sm:p-5" data-testid="finance-categories">
          <h2 className="font-bold text-primary">Para onde foi</h2>
          {r.byCategory.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nenhuma despesa neste mês. Lance as suas abaixo.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {r.byCategory.map((c) => (
                <li key={c.category} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="font-semibold text-slate-800">{c.category}</span><b className="text-slate-900">{formatBRL(c.cents)}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="glass-panel !rounded-[22px] p-4 sm:p-5" aria-labelledby="comissoes" data-testid="finance-commissions">
        <h2 id="comissoes" className="font-bold text-primary">Comissões dos profissionais</h2>
        <p className="text-sm text-slate-600">Calculadas sobre os atendimentos concluídos no mês (o valor pago pelo cliente, já sem o desconto em pontos). {r.commissionsDue > 0 && <b className="text-amber-700">A pagar: {formatBRL(r.commissionsDue)}.</b>}</p>
        {r.commissions.length === 0 ? (
          <EmptyState compact variant="users" title="Nenhum profissional com comissão" text="Cadastre os profissionais em Agenda → Equipe; eles aparecem aqui para você definir o percentual." />
        ) : (
          <ul className="mt-3 space-y-2">
            {r.commissions.map((c) => (
              <li key={c.resourceId} className="glass-inset flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3" data-testid="commission-row">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.services} {c.services === 1 ? 'atendimento' : 'atendimentos'} · {formatBRL(c.baseCents)} · {commissionLabel(c.bp)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {!c.paid && <CommissionPctForm resourceId={c.resourceId} pct={c.bp ? String(c.bp / 100).replace('.', ',') : ''} />}
                  <b className="text-lg text-slate-900" data-testid="commission-value">{formatBRL(c.commissionCents)}</b>
                  {c.paid ? (
                    <form action={undoCommissionAction} className="flex items-center gap-2">
                      <input type="hidden" name="resourceId" value={c.resourceId} /><input type="hidden" name="month" value={month} />
                      <span className="chip-verde" data-testid="commission-paid">Pago em {c.paid.paidAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}</span>
                      <button className="text-xs font-semibold text-slate-500 underline" data-testid="commission-undo">Desfazer</button>
                    </form>
                  ) : c.commissionCents > 0 ? (
                    <form action={payCommissionAction}>
                      <input type="hidden" name="resourceId" value={c.resourceId} /><input type="hidden" name="month" value={month} />
                      <SubmitButton pendingText="…" variant="navy" className="btn-sm !w-auto px-4" data-testid="commission-pay">Registrar pagamento</SubmitButton>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel !rounded-[22px] p-4 sm:p-5" aria-labelledby="lancamentos">
        <h2 id="lancamentos" className="font-bold text-primary">Lançamentos do mês</h2>
        {r.expenses.length + r.incomes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500" data-testid="no-entries">Nada lançado em {monthLabel(month)}.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100" data-testid="entry-list">
            {[...r.incomes, ...r.expenses].sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
              <li key={`${e.id}-${e.date}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5" data-testid="entry-row">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{e.description} {e.recurring && <span className="glass-chip ml-1 !px-2 !py-0.5 !text-[11px]">fixa</span>}</p>
                  <p className="text-xs text-slate-500">{day(e.date)} · {e.category}</p>
                </div>
                <div className="flex items-center gap-3">
                  <b className={e.kind === 'IN' ? 'text-emerald-700' : 'text-rose-700'}>{e.kind === 'IN' ? '+' : '−'} {formatBRL(e.amountCents)}</b>
                  {e.recurring ? (
                    <form action={endFinanceEntry}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="month" value={month} /><button className="text-xs font-semibold text-slate-500 underline" data-testid="entry-end">Encerrar daqui</button></form>
                  ) : null}
                  <form action={deleteFinanceEntry}><input type="hidden" name="id" value={e.id} /><button className="text-xs font-semibold text-rose-600 underline" aria-label={`Excluir ${e.description}`} data-testid="entry-delete">Excluir</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3" open={r.expenses.length + r.incomes.length === 0}>
          <summary className="cursor-pointer text-sm font-bold text-electric-600" data-testid="entry-new">+ Lançar despesa ou entrada</summary>
          <div className="mt-3"><FinanceEntryForm today={todayKey()} /></div>
        </details>
      </section>
    </div>
  );
}
