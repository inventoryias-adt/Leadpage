import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { PlaceAvatar } from '@/components/Visual';
import { campaignBadge, campaignStatus, campaignWhen, canAdopt } from '@/lib/app-campaigns';
import { categoryLabel } from '@/lib/categories';
import { prisma } from '@/lib/db';
import { imageUrl } from '@/lib/images';

export const metadata = { title: 'Campanha do app' };
export const dynamic = 'force-dynamic';

export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await prisma.appCampaign.findUnique({
    where: { id },
    include: {
      promotions: {
        where: { active: true, restaurant: { subscriptionStatus: 'ACTIVE', onboardedAt: { not: null }, listed: true } },
        select: { restaurant: { select: { id: true, name: true, category: true, categoryOther: true, logoImageId: true, units: { where: { active: true }, select: { address: true }, take: 1 } } } },
      },
    },
  });
  if (!c || !canAdopt(c)) notFound();
  const places = c.promotions.map((p) => p.restaurant).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const live = campaignStatus(c) === 'now';

  return (
    <main className="space-y-6 p-4 sm:p-6 md:pt-8">
      <Link href="/carteira" className="inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> Início</Link>

      <header className="rounded-[22px] bg-gradient-to-br from-[#1A3FA3] to-[#2150C9] p-5 text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"><Icon name="spark" size={13} /> Campanha do app{live ? ' · valendo agora' : ''}</span>
        <p className="mt-3 text-4xl font-bold leading-none">{campaignBadge(c)}</p>
        <h1 className="mt-2 text-lg font-bold leading-snug">{c.title}</h1>
        <p className="mt-1 text-sm opacity-90">{campaignWhen(c)}</p>
        {c.description && <p className="mt-3 text-sm opacity-95">{c.description}</p>}
      </header>

      <section aria-labelledby="participam">
        <h2 id="participam" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Lugares que participam ({places.length})</h2>
        <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {places.map((r) => (
            <li key={r.id}>
              <Link href={`/lugar/${r.id}`} className="glass-panel-sm card-link flex items-center gap-3 !rounded-[22px] p-3.5">
                <PlaceAvatar name={r.name} src={imageUrl(r.logoImageId)} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-900">{r.name}</span>
                  <span className="block truncate text-xs text-slate-500">{[categoryLabel(r.category, r.categoryOther), r.units[0]?.address].filter(Boolean).join(' · ')}</span>
                </span>
                <Icon name="chevron" size={18} className="text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">Os pontos da campanha saem sozinhos quando o caixa lança a sua compra, e só nos lugares da lista.</p>
      </section>
    </main>
  );
}
