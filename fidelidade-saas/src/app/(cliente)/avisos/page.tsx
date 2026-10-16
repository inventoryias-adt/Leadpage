import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { Illustration } from '@/components/Illustrations';
import { MarkRead } from '@/components/MarkRead';
import { NextBookingCard } from '@/components/NextBookingCard';
import { prisma } from '@/lib/db';
import { colorOf } from '@/lib/palette';
import { noticeKind } from '@/lib/notice-kind';
import { formatDateTimeBR } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Avisos' };
export const dynamic = 'force-dynamic';

export default async function AvisosPage() {
  const customer = await requireCustomer('/avisos');
  const [items, asking] = await Promise.all([
    prisma.notification.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    // Lembrete enviado e ainda sem resposta: "Sim, estarei lá" / "Liberar" direto nos avisos.
    prisma.booking.findMany({
      where: { customerId: customer.id, status: { in: ['PENDING', 'CONFIRMED'] }, reminderSentAt: { not: null }, reminderAnswer: null, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      include: { restaurant: { select: { name: true } }, resource: { select: { name: true } } },
    }),
  ]);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <main className="p-4 sm:p-6 md:pt-8">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">Avisos</h1>
        <p className="text-sm text-slate-600">
          {unread > 0 ? `${unread} ${unread === 1 ? 'novo' : 'novos'}. ` : ''}Pontos recebidos, prêmios que estão perto e desafios.
        </p>
      </header>

      {asking.length > 0 && (
        <ul className="mx-auto mb-4 max-w-2xl space-y-3" aria-label="Horários para confirmar">
          {asking.map((b) => <li key={b.id}><NextBookingCard booking={b} back="/avisos" /></li>)}
        </ul>
      )}

      {items.length === 0 && asking.length === 0 ? (
        <div className="glass-panel mx-auto flex max-w-xl flex-col items-center p-6 text-center">
          <Illustration variant="empty" size={150} />
          <p className="font-bold text-slate-800">Nenhum aviso por enquanto</p>
          <p className="mt-1 max-w-xs text-sm text-slate-600">Quando você ganhar pontos ou estiver perto de um prêmio, avisamos por aqui.</p>
        </div>
      ) : (
        <ul className="mx-auto max-w-2xl space-y-3">
          {items.map((n) => {
            const kind = noticeKind(n);
            const tone = colorOf(kind.color);
            const card = (
              <div className={`glass-panel flex items-start gap-3 !rounded-[20px] p-4 ${n.readAt ? '' : 'ring-2 ring-electric-600/25'}`}>
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={n.readAt ? { background: '#F1F5F9', color: '#64748B' } : { background: tone.soft, color: tone.hex }}>
                  <Icon name={kind.icon} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800">{n.title}</p>
                  <p className="text-sm text-slate-600">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTimeBR(n.createdAt)}</p>
                </div>
                {!n.readAt && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-electric-600" aria-label="Novo" />}
              </div>
            );
            return <li key={n.id}>{n.href ? <Link href={n.href} className="card-link block">{card}</Link> : card}</li>;
          })}
        </ul>
      )}
      {unread > 0 && <MarkRead />}
    </main>
  );
}
