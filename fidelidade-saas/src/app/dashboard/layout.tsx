import { logout } from '@/app/actions/auth';
import { DashboardNav } from '@/components/DashboardNav';
import { requireRestaurant } from '@/lib/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const restaurant = await requireRestaurant();
  const ready = restaurant.subscriptionStatus === 'ACTIVE' && !!restaurant.onboardedAt;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-28 pt-4 sm:px-6 md:pb-10">
      <header className="glass-panel-sm mb-6 flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-electric-600">Fidelize</p>
          <p className="truncate font-bold text-primary">{restaurant.name}</p>
        </div>
        {ready && <DashboardNav variant="top" />}
        <form action={logout}>
          <button className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-white/60">Sair</button>
        </form>
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
