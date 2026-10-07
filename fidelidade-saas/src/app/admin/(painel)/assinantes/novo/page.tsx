import Link from 'next/link';
import { CreateForm } from '@/components/AdminForms';

export const metadata = { title: 'Novo assinante' };

export default function NovoAssinante() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/admin/assinantes" className="text-sm font-semibold text-electric-600">← Todos os assinantes</Link>
      <section className="glass-panel p-5 sm:p-7">
        <h1 className="mb-1 text-xl font-semibold text-primary">Novo assinante</h1>
        <p className="mb-5 text-sm text-slate-500">Crie a conta de um estabelecimento. Você recebe uma senha temporária para passar ao dono.</p>
        <CreateForm />
      </section>
    </div>
  );
}
