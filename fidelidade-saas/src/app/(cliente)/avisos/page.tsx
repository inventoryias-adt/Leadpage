import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { Illustration } from '@/components/Illustrations';
import { MarkRead } from '@/components/MarkRead';
import { prisma } from '@/lib/db';
import { formatDateTimeBR } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Avisos' };
export const dynamic = 'force-dynamic';

export default async function AvisosPage() {
  const customer = await requireCustomer('/avisos');
  const items = await prisma.notification.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <main className="p-4 sm:p-6 md:pt-8">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">Avisos</h1>
        <p className="text-sm text-slate-600">
          {unread > 0 ? `${unread} ${unread === 1 ? 'novo' : 'novos'}. ` : ''}Pontos recebidos, prêmios que estão perto e desafios.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="glass-panel mx-auto flex max-w-xl flex-col items-center p-6 text-center">
          <Illustration variant="empty" size={150} />
          <p className="font-bold text-slate-800">Nenhum aviso por enquanto</p>
          <p className="mt-1 max-w-xs text-sm text-slate-600">Quando você ganhar pontos ou estiver perto de um prêmio, avisamos por aqui.</p>
        </div>
      ) : (
        <ul className="mx-auto max-w-2xl space-y-3">
          {items.map((n) => {
            const card = (
              <div className={`glass-panel-sm flex items-start gap-3 p-4 ${n.readAt ? '' : 'ring-2 ring-electric-600/30'}`}>
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.readAt ? 'bg-slate-100 text-slate-500' : 'bg-electric-600/10 text-electric-600'}`}>
                  <Icon name="bell" size={18} />
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
