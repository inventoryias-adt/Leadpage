import { Brand } from '@/components/Brand';
import { AdminNav } from '@/components/AdminNav';
import { adminLogout } from '@/app/actions/admin';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-4 sm:px-6">
      <header className="glass-panel-sm mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Brand href="/admin" />
          <span className="rounded-md bg-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">Admin</span>
        </div>
        <AdminNav />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 md:inline">{admin.email}</span>
          <form action={adminLogout}>
            <button className="glass-button-ghost btn-sm">Sair</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
