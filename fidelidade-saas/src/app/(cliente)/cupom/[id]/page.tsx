import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { UnitsHours } from '@/components/UnitsHours';
import { VoucherTicket } from '@/components/VoucherTicket';
import { prisma } from '@/lib/db';
import { formatDateTimeBR, formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Seu cupom' };
export const dynamic = 'force-dynamic';

/** Tela própria do cupom de um prêmio resgatado: o código grande para mostrar no balcão e como retirar. */
export default async function CupomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const customer = await requireCustomer(`/cupom/${id}`);
  const v = await prisma.redemption.findFirst({
    where: { id, customerId: customer.id },
    include: { restaurant: { select: { id: true, name: true, units: { where: { active: true }, orderBy: { createdAt: 'asc' } } } }, usedUnit: { select: { name: true } } },
  });
  if (!v) notFound();
  const used = v.status === 'USED';

  return (
    <main className="mx-auto max-w-xl space-y-5 p-4 sm:p-6 md:pt-8">
      <Link href="/perfil/premios" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> Meus prêmios</Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">{used ? 'Prêmio entregue' : 'Seu prêmio está pronto'}</h1>
        <p className="text-sm text-slate-600">
          {used ? `Retirado${v.usedAt ? ` em ${formatDateTimeBR(v.usedAt)}` : ''}${v.usedUnit ? ` · ${v.usedUnit.name}` : ''}.` : `Resgatado por ${formatPoints(v.pointsCost)} pontos em ${formatDateTimeBR(v.createdAt)}.`}
        </p>
      </header>

      <VoucherTicket code={v.code} rewardName={v.rewardName} placeName={v.restaurant.name} cashCents={v.cashCents} used={used} />

      {!used && (
        <section className="glass-panel !rounded-[22px] p-4" aria-labelledby="como">
          <h2 id="como" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Como retirar</h2>
          <ol className="space-y-3 text-sm text-slate-700">
            {['Vá até o lugar no horário de funcionamento.', 'Mostre este código no balcão.', v.cashCents > 0 ? 'Pague a diferença em dinheiro e receba o prêmio.' : 'Receba o prêmio. Pronto!'].map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lima text-xs font-extrabold text-primary">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </section>
      )}

      {!used && v.restaurant.units.length > 0 && <UnitsHours units={v.restaurant.units} title="Horário para retirar seu prêmio" />}

      <Link href={`/carteira/${v.restaurant.id}`} className="glass-button-ghost">Ver minha carteira em {v.restaurant.name}</Link>
    </main>
  );
}
