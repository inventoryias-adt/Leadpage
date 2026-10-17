import Link from 'next/link';
import { adminSetLeadStatus } from '@/app/actions/lead';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/db';
import { formatPhone } from '@/lib/br';
import { categoryLabel } from '@/lib/categories';
import { LEAD_STATUS, SOURCE_LABEL, leadWhatsapp, type LeadSource, type LeadStatus } from '@/lib/lead';
import { formatDateTimeBR } from '@/lib/points';

export const metadata = { title: 'Contatos de interessados' };
export const dynamic = 'force-dynamic';

const TABS = [['novos', 'Novos'], ['todos', 'Todos']] as const;
const LOOK: Record<LeadStatus, string> = { NEW: 'bg-rose-100 text-rose-700', CONTACTED: 'bg-amber-100 text-amber-800', WON: 'bg-emerald-100 text-emerald-700', LOST: 'bg-slate-200 text-slate-600' };

export default async function Contatos({ searchParams }: { searchParams: Promise<{ st?: string }> }) {
  const st = (await searchParams).st === 'todos' ? 'todos' : 'novos';
  const [leads, novos, total] = await Promise.all([
    prisma.lead.findMany({ where: st === 'novos' ? { status: 'NEW' } : undefined, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.lead.count({ where: { status: 'NEW' } }),
    prisma.lead.count(),
  ]);
  const act = (id: string, status: LeadStatus, label: string, cls = 'glass-button-ghost') => (
    <form action={adminSetLeadStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`${cls} btn-sm`}>{label}</button>
    </form>
  );
  return (
    <div className="space-y-5">
      <section className="glass-panel p-5 sm:p-7">
        <h1 className="mb-1 text-xl font-semibold text-primary">Contatos de interessados</h1>
        <p className="text-sm text-slate-500">
          Comerciantes que deixaram o contato no QR Code do cartaz, no app do cliente ou no site. Cada um também chega por e-mail (LEAD_EMAIL, ou SUPPORT_EMAIL se não houver).
        </p>
        <nav aria-label="Situação" className="mt-4 flex gap-2">
          {TABS.map(([k, label]) => (
            <Link key={k} href={k === 'novos' ? '/admin/contatos' : '/admin/contatos?st=todos'} aria-current={st === k ? 'true' : undefined} className={`chip-link ${st === k ? 'chip-link-active' : ''}`}>
              {label} <span className="ml-1 text-xs font-bold opacity-70">{k === 'novos' ? novos : total}</span>
            </Link>
          ))}
        </nav>
      </section>

      {leads.length === 0 ? (
        <EmptyState variant="users" title={st === 'novos' ? 'Nenhum contato novo' : 'Ainda não há contatos'} text="Quando um comerciante preencher o formulário, ele aparece aqui e chega no seu e-mail." />
      ) : (
        <ul className="space-y-3">
          {leads.map((l) => (
            <li key={l.id} className="glass-panel space-y-3 p-5" data-testid="lead-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-primary">{l.business}</p>
                  <p className="text-sm text-slate-700">{l.name} · {categoryLabel(l.category, l.categoryOther) ?? l.category} · {[l.city, l.state].filter(Boolean).join(' / ')}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${LOOK[l.status as LeadStatus] ?? LOOK.NEW}`}>{LEAD_STATUS[l.status as LeadStatus] ?? l.status}</span>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={leadWhatsapp(l.phone, l.name)} target="_blank" rel="noopener noreferrer" className="link-inline">{formatPhone(l.phone)} (WhatsApp)</a>
                <a href={`mailto:${l.email}`} className="link-inline">{l.email}</a>
              </p>
              {l.message && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">“{l.message}”</p>}
              <p className="text-xs text-slate-500">
                {formatDateTimeBR(l.createdAt)} · {SOURCE_LABEL[l.source as LeadSource] ?? l.source}{l.emailSent ? ' · e-mail enviado' : ' · e-mail não enviado'}
                {l.contactedAt ? ` · contatado em ${formatDateTimeBR(l.contactedAt)}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {l.status === 'NEW' && act(l.id, 'CONTACTED', 'Marcar como contatado', 'glass-button')}
                {l.status === 'CONTACTED' && act(l.id, 'WON', 'Virou cliente', 'glass-button')}
                {(l.status === 'NEW' || l.status === 'CONTACTED') && act(l.id, 'LOST', 'Sem interesse')}
                {l.status !== 'NEW' && act(l.id, 'NEW', 'Reabrir')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
