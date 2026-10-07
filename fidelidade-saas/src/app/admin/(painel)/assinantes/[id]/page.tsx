import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminImpersonate, adminResetGuide } from '@/app/actions/admin';
import { EditForm, NoteForm, ResetPasswordForm, StatusForm } from '@/components/AdminForms';
import { StatusChip } from '@/components/StatusChip';
import { formatPhone } from '@/lib/br';
import { prisma } from '@/lib/db';
import { startOfMonthBR, formatBRL, formatDateTimeBR, formatPoints } from '@/lib/points';

export const metadata = { title: 'Assinante' };

function Card({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="glass-panel p-5 sm:p-6" aria-labelledby={id}>
      <h2 id={id} className="mb-4 font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
    <dt className="text-slate-500">{k}</dt>
    <dd className="min-w-0 truncate text-right font-medium text-slate-800">{v}</dd>
  </div>
);

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const since = startOfMonthBR();

  const r = await prisma.restaurant.findUnique({ where: { id }, include: { units: { orderBy: { createdAt: 'asc' } } } });
  if (!r) notFound();

  const [customers, rewards, promos, challenges, month, recent, logs] = await Promise.all([
    prisma.wallet.count({ where: { restaurantId: id } }),
    prisma.reward.count({ where: { restaurantId: id, active: true } }),
    prisma.promotion.count({ where: { restaurantId: id, active: true } }),
    prisma.challenge.count({ where: { restaurantId: id, active: true } }),
    prisma.claim.aggregate({ where: { restaurantId: id, redeemedAt: { gte: since } }, _sum: { points: true, amountCents: true }, _count: true }),
    prisma.claim.findMany({ where: { restaurantId: id, redeemedAt: { not: null } }, orderBy: { redeemedAt: 'desc' }, take: 6, select: { id: true, amountCents: true, points: true, redeemedAt: true, customer: { select: { name: true } } } }),
    prisma.adminLog.findMany({ where: { restaurantId: id }, orderBy: { createdAt: 'desc' }, take: 6 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/assinantes" className="text-sm font-semibold text-electric-600">← Todos os assinantes</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-primary">{r.name}</h1>
            <p className="text-sm text-slate-500">{r.email} · {formatPhone(r.phone)}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusChip status={r.subscriptionStatus} />
            <form action={adminImpersonate}>
              <input type="hidden" name="id" value={r.id} />
              <button className="glass-button btn-sm" title="Abre o painel do assinante por 2 horas, com faixa de aviso e registro">Entrar como este assinante</button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Resumo" id="resumo">
          <dl className="divide-y divide-[#e4e7f3]">
            <Row k="Cadastro" v={formatDateTimeBR(r.createdAt)} />
            <Row k="Configuração" v={r.onboardedAt ? `concluída em ${formatDateTimeBR(r.onboardedAt).split(' às ')[0]}` : 'não concluída'} />
            <Row k="Unidades ativas" v={r.units.filter((u) => u.active).length} />
            <Row k="Clientes na carteira" v={formatPoints(customers)} />
            <Row k="Prêmios · campanhas · desafios" v={`${rewards} · ${promos} · ${challenges}`} />
            <Row k="Neste mês" v={`${month._count} lançamentos · ${formatBRL(month._sum.amountCents ?? 0)} · ${formatPoints(month._sum.points ?? 0)} pts`} />
            <Row k="Guia inicial" v={r.guideDoneAt ? 'concluído' : 'ainda aberto'} />
            <Row k="ID do pagamento" v={r.paymentSubscriptionId ?? r.paymentCustomerId ?? '—'} />
          </dl>
        </Card>

        <Card title="Unidades" id="unidades">
          <ul className="divide-y divide-[#e4e7f3]">
            {r.units.map((u) => (
              <li key={u.id} className="py-2.5">
                <p className="flex items-center justify-between gap-3 font-semibold text-slate-800">
                  {u.name}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{u.active ? 'Ativa' : 'Inativa'}</span>
                </p>
                <p className="text-xs text-slate-500">{u.address || 'Sem endereço'} · {u.latitude != null ? 'com localização' : 'sem localização'} · {u.openingSchedule ? 'com horário' : 'sem horário'}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Assinatura" id="assinatura">
          <StatusForm id={r.id} current={r.subscriptionStatus} />
        </Card>

        <Card title="Dados e regras" id="dados">
          <EditForm r={{ id: r.id, name: r.name, phone: r.phone, pointsPerReal: r.pointsPerReal, maxRedeemsPerMonth: r.maxRedeemsPerMonth, checkInPoints: r.checkInPoints, referralPoints: r.referralPoints, listed: r.listed }} />
        </Card>

        <Card title="Acesso do dono" id="acesso">
          <ResetPasswordForm id={r.id} />
          <form action={adminResetGuide} className="mt-5 border-t border-[#e4e7f3] pt-4">
            <input type="hidden" name="id" value={r.id} />
            <p className="mb-2 text-sm text-slate-600">Reabre o passo a passo inicial na próxima vez que o dono entrar.</p>
            <button className="glass-button-ghost btn-sm" disabled={!r.guideDoneAt}>Reabrir guia inicial</button>
          </form>
        </Card>

        <Card title="Anotação interna" id="nota">
          <NoteForm id={r.id} note={r.internalNote ?? ''} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Últimos lançamentos" id="lanc">
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma compra creditada ainda.</p>
          ) : (
            <ul className="divide-y divide-[#e4e7f3] text-sm">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800">{c.customer?.name ?? 'Cliente'}</span>
                    <span className="text-xs text-slate-500">{c.redeemedAt ? formatDateTimeBR(c.redeemedAt) : ''}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-primary">{c.amountCents > 0 ? formatBRL(c.amountCents) : '—'}</span>
                    <span className="text-xs text-slate-500">{formatPoints(c.points)} pts</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ações da administração nesta conta" id="logs">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma ação registrada.</p>
          ) : (
            <ul className="divide-y divide-[#e4e7f3] text-sm">
              {logs.map((l) => (
                <li key={l.id} className="py-2.5">
                  <p className="font-semibold text-slate-800">{l.detail}</p>
                  <p className="text-xs text-slate-500">{l.adminEmail} · {formatDateTimeBR(l.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
