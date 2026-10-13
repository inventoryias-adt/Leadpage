import { adminToggleAppCampaign } from '@/app/actions/app-campaigns';
import { AppCampaignForm } from '@/components/AppCampaignForm';
import { EmptyState } from '@/components/EmptyState';
import { campaignBadge, campaignStatus, campaignWhen } from '@/lib/app-campaigns';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Campanhas do app' };
export const dynamic = 'force-dynamic';

const ymd = (d: Date | null) => (d ? new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10) : '');
const endYmd = (d: Date | null) => (d ? ymd(new Date(d.getTime() - 1)) : '');

const LOOK = { now: ['Valendo agora', 'bg-emerald-100 text-emerald-700'], scheduled: ['Agendada', 'bg-blue-100 text-electric-600'], paused: ['Desligada', 'bg-slate-200 text-slate-600'], ended: ['Encerrada', 'bg-slate-200 text-slate-500'] } as const;

export default async function Campanhas() {
  const campaigns = await prisma.appCampaign.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { promotions: true } } } });
  const now = new Date();
  return (
    <div className="space-y-5">
      <section className="glass-panel p-5 sm:p-7">
        <h1 className="mb-1 text-xl font-semibold text-primary">Campanhas do app</h1>
        <p className="text-sm text-slate-500">
          Você propõe (ex.: pontos em dobro na terça e quinta) e cada estabelecimento escolhe se adota, em Regras → Campanhas. Quem adota ganha uma campanha própria, que vale no caixa e aparece para os clientes no Início do app.
        </p>
      </section>

      <section className="glass-panel p-5 sm:p-7">
        <h2 className="mb-4 text-base font-semibold text-primary">Nova campanha</h2>
        <AppCampaignForm uid="novo" />
      </section>

      {campaigns.length === 0 ? (
        <EmptyState variant="coin" title="Nenhuma campanha do app ainda" text="Crie a primeira acima. Ela aparece para os donos escolherem se participam." />
      ) : (
        <ul className="space-y-3">
          {campaigns.map((c) => {
            const [label, cls] = LOOK[campaignStatus(c, now)];
            return (
              <li key={c.id} className="glass-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{c.title}</p>
                    <p className="text-xs text-slate-500">{campaignWhen(c)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{c._count.promotions} {c._count.promotions === 1 ? 'estabelecimento adotou' : 'estabelecimentos adotaram'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="glass-chip">{campaignBadge(c)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={adminToggleAppCampaign}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="glass-button-ghost btn-sm">{c.active ? 'Desligar' : 'Ligar'}</button>
                  </form>
                </div>
                <details className="mt-3">
                  <summary className="link-inline cursor-pointer text-sm">Editar</summary>
                  <div className="mt-3">
                    <AppCampaignForm
                      uid={`ed-${c.id}`}
                      initial={{
                        id: c.id, title: c.title, description: c.description, kind: c.kind, multiplier: c.multiplier, bonusPoints: c.bonusPoints,
                        minAmount: c.minAmountCents ? (c.minAmountCents / 100).toFixed(2).replace('.', ',') : '', weekdays: c.weekdays,
                        startTime: c.startTime, endTime: c.endTime, startDate: ymd(c.startsAt), endDate: endYmd(c.endsAt),
                      }}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
