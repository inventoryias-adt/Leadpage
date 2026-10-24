import Link from 'next/link';
import { cancelClubByCustomer } from '@/app/actions/club';
import { Brand } from '@/components/Brand';
import { EmptyState } from '@/components/EmptyState';
import { PlaceAvatar, ProgressBar } from '@/components/Visual';
import { STATE_LABEL, type SubState } from '@/lib/club';
import { subscriptionsOfCustomer } from '@/lib/club-db';
import { imageUrl } from '@/lib/images';
import { formatBRL } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Meus planos' };
export const dynamic = 'force-dynamic';

const dmy = (key: string | null) => (key ? key.split('-').reverse().join('/') : '');
const TONE: Record<SubState, string> = { AWAITING: 'bg-amber-50 text-amber-800', ACTIVE: 'bg-emerald-50 text-emerald-700', DUE: 'bg-rose-50 text-rose-700', ENDING: 'bg-slate-100 text-slate-600', ENDED: 'bg-slate-100 text-slate-500' };

export default async function MeusPlanosPage({ searchParams }: { searchParams: Promise<{ pedido?: string; erro?: string }> }) {
  const customer = await requireCustomer('/perfil/clube');
  const sp = await searchParams;
  const subs = (await subscriptionsOfCustomer(customer.id)).filter((s) => s.state !== 'ENDED' || s.paidPeriods > 0);
  return (
    <main className="space-y-5 p-4 sm:p-6 md:pt-8">
      <header>
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <Link href="/perfil" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-electric-600 md:mt-0">‹ Perfil</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Meus planos</h1>
        <p className="text-sm text-slate-600">Assinaturas dos lugares. Cada agendamento coberto pelo plano abate do seu saldo do mês, sem cobrança.</p>
      </header>
      {sp.pedido && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700" data-testid="club-requested">Pedido enviado! Faça o primeiro pagamento no balcão para o plano começar a valer.</p>}
      {sp.erro && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700" data-testid="club-error">{sp.erro}</p>}
      {subs.length === 0 ? (
        <EmptyState variant="gift" title="Você ainda não assina nenhum plano" text="Abra um lugar que tenha clube de assinatura e toque em Quero assinar." />
      ) : (
        <ul className="space-y-3" data-testid="my-subs">
          {subs.map((s) => (
            <li key={s.id} className="glass-panel space-y-3 !rounded-[22px] p-4" data-testid="my-sub">
              <div className="flex items-start gap-3">
                <Link href={`/lugar/${s.restaurant.id}`}><PlaceAvatar name={s.restaurant.name} src={imageUrl(s.restaurant.logoImageId)} size={44} /></Link>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900">{s.planName}</p>
                  <p className="truncate text-sm text-slate-600">{s.restaurant.name} · {formatBRL(s.priceCents)}/mês</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[s.state]}`} data-testid="my-sub-state">{STATE_LABEL[s.state]}</span>
              </div>
              {s.state === 'AWAITING' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Falta o primeiro pagamento: pague no balcão e o lugar libera o plano.</p>}
              {s.state === 'DUE' && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">O mês pago terminou em {dmy(s.coveredUntil)}. Renove no balcão para continuar usando.</p>}
              {s.cycle && (s.state === 'ACTIVE' || s.state === 'ENDING') && (
                <div className="space-y-2" data-testid="my-sub-balance">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seu saldo neste ciclo · {dmy(s.cycle.start)} a {dmy(s.cycle.end)}</p>
                  {s.balances.map((b) => (
                    <div key={b.serviceId}>
                      <p className="flex justify-between text-sm"><span className="font-semibold text-slate-800">{b.name}</span><span className="text-slate-600" data-testid="balance-left">restam {b.left} de {b.quantity}</span></p>
                      <ProgressBar value={b.used} max={b.quantity} label={`${b.name}: ${b.used} de ${b.quantity} usados`} />
                    </div>
                  ))}
                  <p className="text-xs text-slate-500">Pago até {dmy(s.coveredUntil)}. Ao agendar um serviço do plano, o saldo abate sozinho.</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/lugar/${s.restaurant.id}/agendar`} className="glass-button-navy btn-sm !w-auto px-4">Agendar</Link>
                {s.status === 'ACTIVE' && (
                  <form action={cancelClubByCustomer} data-testid="cancel-form"><input type="hidden" name="id" value={s.id} /><button className="text-xs font-semibold text-rose-600 underline" data-testid="my-sub-cancel">Cancelar assinatura</button></form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
