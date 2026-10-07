import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/AdminForms';
import { Brand } from '@/components/Brand';
import { getAdmin } from '@/lib/session';

export const metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default async function AdminEntrar() {
  if (await getAdmin()) redirect('/admin');
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-center gap-3">
        <Brand href="/" />
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">Admin</span>
      </div>
      <div className="glass-panel p-6 sm:p-8">
        <h1 className="mb-1 text-2xl font-semibold text-primary">Acesso da administração</h1>
        <p className="mb-6 text-sm text-slate-500">Área restrita. Os acessos ficam registrados.</p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
