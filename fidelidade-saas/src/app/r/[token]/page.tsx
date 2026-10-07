import { Brand } from '@/components/Brand';
import { claimPoints } from '@/app/actions/customer';
import { CustomerAuthForm } from '@/components/AuthForms';
import { prisma } from '@/lib/db';
import { formatPoints } from '@/lib/points';
import { getCustomer } from '@/lib/session';
import { UnitsHours } from '@/components/UnitsHours';
import { ClaimForm } from './ClaimForm';

export const metadata = { title: 'Resgatar pontos' };
export const dynamic = 'force-dynamic';

function Message({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-panel w-full max-w-md p-8 text-center">
        <div className="mb-5 flex justify-center"><Brand href="/entrar" /></div>
        <h1 className="mb-2 text-xl font-bold text-primary">{title}</h1>
        <p className="text-slate-600">{text}</p>
      </div>
    </main>
  );
}

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Esta página só LÊ. O crédito acontece num POST explícito, para que pré-visualizadores de
  // link (WhatsApp, etc.) não consumam o QR Code antes do cliente.
  const [claim, customer] = await Promise.all([
    prisma.claim.findUnique({ where: { token }, include: {
        unit: { select: { id: true, name: true, address: true, openingSchedule: true } },
        restaurant: { select: { name: true, units: { where: { active: true }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, address: true, openingSchedule: true } } } },
      } }),
    getCustomer(),
  ]);

  if (!claim) return <Message title="QR Code inválido" text="Confira o link ou peça um novo no balcão." />;
  if (claim.redeemedAt) return <Message title="QR Code já utilizado" text="Esses pontos já foram creditados em uma carteira." />;
  if (claim.expiresAt < new Date()) return <Message title="QR Code expirado" text="Peça um novo no balcão do restaurante." />;

  // Mostra a unidade onde a compra foi lançada (ou todas, se não houver registro).
  const hoursUnits = claim.unit ? [claim.unit] : claim.restaurant.units;

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-panel w-full max-w-md p-8">
        <div className="mb-4 flex justify-center"><Brand href="/entrar" /></div>
        <p className="text-center text-sm font-semibold text-slate-500">{claim.restaurant.name}</p>
        <div className="my-4 text-center">
          <p className="text-sm text-slate-600">Você ganhou</p>
          <p className="text-6xl font-extrabold text-primary">{formatPoints(claim.points)}</p>
          <p className="font-semibold text-electric-600">pontos</p>
          <p className="mt-2 text-xs text-slate-500">{claim.description}</p>
        </div>

        {/* Quando e onde retirar: informação importante antes mesmo de entrar. */}
        {/* Quando e onde retirar: informação importante antes mesmo de entrar. */}
        <div className="mb-5">
          <UnitsHours units={hoursUnits} title="Quando você pode vir resgatar" showNames={claim.restaurant.units.length > 1} />
          {claim.restaurant.units.length > 1 && <p className="mt-2 text-center text-xs text-slate-500">Você pode retirar em qualquer unidade.</p>}
        </div>

        {customer ? (
          <ClaimForm token={token} name={customer.name.split(' ')[0]} action={claimPoints} />
        ) : (
          <>
            <p className="mb-4 text-center text-sm text-slate-600">Entre com CPF e telefone para receber seus pontos.</p>
            <CustomerAuthForm token={token} cta="Receber meus pontos" />
          </>
        )}
      </div>
    </main>
  );
}
