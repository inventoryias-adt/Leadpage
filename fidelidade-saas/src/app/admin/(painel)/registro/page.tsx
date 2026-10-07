import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/db';
import { formatDateTimeBR } from '@/lib/points';

export const metadata = { title: 'Registro' };

const LABEL: Record<string, string> = { status: 'Status', editar: 'Dados', senha: 'Senha', guia: 'Guia', nota: 'Anotação', impersonar: 'Suporte', convite: 'Convite' };

export default async function Registro() {
  const logs = await prisma.adminLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return (
    <div className="space-y-5">
      <section className="glass-panel p-5 sm:p-7">
        <h1 className="mb-1 text-xl font-semibold text-primary">Registro de ações</h1>
        <p className="text-sm text-slate-500">Tudo o que a administração fez nas contas dos assinantes. As 200 mais recentes.</p>
      </section>
      {logs.length === 0 ? (
        <EmptyState variant="shield" title="Nada registrado ainda" text="As ações feitas nas fichas dos assinantes aparecem aqui." />
      ) : (
        <ul className="glass-panel divide-y divide-[#e4e7f3]">
          {logs.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3 px-5 py-3.5 text-sm">
              <span className="min-w-0">
                <span className="mb-0.5 inline-block rounded-full border border-[#e0e4f2] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">{LABEL[l.action] ?? l.action}</span>
                <span className="block font-semibold text-slate-800">{l.detail}</span>
                <span className="block text-xs text-slate-500">
                  {l.adminEmail} · {l.restaurantId ? <Link href={`/admin/assinantes/${l.restaurantId}`} className="link-inline">{l.restaurantName ?? 'assinante'}</Link> : 'plataforma'}
                </span>
              </span>
              <span className="shrink-0 text-xs text-slate-500">{formatDateTimeBR(l.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
