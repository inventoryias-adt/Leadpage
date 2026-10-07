import { Brand } from '@/components/Brand';
import { SideArt } from '@/components/Illustrations';
import { OwnerGuide } from '@/components/OwnerGuide';
import { prisma } from '@/lib/db';
import { appUrl } from '@/lib/payments';
import { parseSchedule } from '@/lib/hours';
import { logout } from '@/app/actions/auth';
import { DashboardNav } from '@/components/DashboardNav';
import { requireRestaurant } from '@/lib/session';
import { UnitSwitcher } from '@/components/UnitSwitcher';
import { currentUnit } from '@/lib/units';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const restaurant = await requireRestaurant();
  const ready = restaurant.subscriptionStatus === 'ACTIVE' && !!restaurant.onboardedAt;
  const { unit, units } = ready ? await currentUnit(restaurant.id) : { unit: null, units: [] };

  // Passo a passo inicial: só para quem já pagou. O progresso mostra o que já está feito.
  const paid = restaurant.subscriptionStatus === 'ACTIVE';
  const guide = paid
    ? await Promise.all([
        prisma.unit.findMany({ where: { restaurantId: restaurant.id, active: true }, select: { address: true, openingSchedule: true } }),
        prisma.reward.count({ where: { restaurantId: restaurant.id, active: true } }),
        prisma.promotion.count({ where: { restaurantId: restaurant.id } }),
      ])
    : null;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-28 pt-4 sm:px-6 md:pb-10">
      <SideArt container="72rem" />
      <header className="glass-panel-sm mb-6 flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Brand href="/dashboard" />
          <span className="hidden h-6 w-px bg-slate-300 sm:block" />
          <p className="hidden truncate text-sm font-semibold text-slate-600 sm:block">{restaurant.name}</p>
        </div>
        {ready && <DashboardNav variant="top" />}
        <div className="flex items-center gap-2">
          {unit && units.length > 1 && <UnitSwitcher units={units.map((u) => ({ id: u.id, name: u.name }))} currentId={unit.id} />}
        {guide && (
          <OwnerGuide
            autoOpen={!restaurant.guideDoneAt}
            clientUrl={`${appUrl()}/entrar`}
            progress={{
              identity: !!(restaurant.category || restaurant.logoImageId),
              unit: guide[0].some((u) => u.address && parseSchedule(u.openingSchedule)),
              rewards: guide[1] > 0,
              onboarded: !!restaurant.onboardedAt,
              promos: guide[2] > 0,
            }}
          />
        )}
        <form action={logout}>
          <button className="glass-button-ghost btn-sm">Sair</button>
        </form>
        </div>
      </header>

      {children}

      {/* Barra inferior no celular: o caixa usa o painel com uma mão só. */}
      {ready && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 px-4 pt-2 md:hidden">
          <DashboardNav variant="bottom" />
        </div>
      )}
    </div>
  );
}
