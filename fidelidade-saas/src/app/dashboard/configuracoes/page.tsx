import { removeChallenge, removeInteraction, removePromotion, removeReward, removeUnit, togglePromotion } from '@/app/actions/restaurant';
import {
  AddChallengeForm,
  AddPromotionForm,
  AddInteractionForm,
  AddRewardForm,
  BasicsForm,
  EngagementForm,
  FinishOnboardingForm,
  IdentityForm,
  PasswordForm,
  RewardPhotoForm,
  RulesForm,
  UnitForm,
} from '@/components/SettingsForms';
import { EmptyState } from '@/components/EmptyState';
import { RewardImage } from '@/components/Visual';
import { describeChallenge } from '@/lib/challenges';
import { prisma } from '@/lib/db';
import { imageUrl } from '@/lib/images';
import { formatBRL, formatPoints } from '@/lib/points';
import { promoBadge, promoStatus, promoWhen } from '@/lib/promos';
import { requirePaidRestaurant } from '@/lib/session';

export const metadata = { title: 'Regras e configurações' };
export const dynamic = 'force-dynamic';

function Section({ id, n, title, hint, children }: { id: string; n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="glass-panel scroll-mt-4 p-5 sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-electric-600 text-sm font-bold text-white">{n}</span>
        <div>
          <h2 className="text-lg font-bold text-primary">{title}</h2>
          {hint && <p className="text-sm text-slate-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function RemoveButton({ action, id, label }: { action: (fd: FormData) => Promise<void>; id: string; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger btn-sm" aria-label={`Remover ${label}`}>
        Remover
      </button>
    </form>
  );
}

const SECTIONS = [
  ['dados', 'Marca'],
  ['identidade', 'Identidade'],
  ['unidades', 'Unidades'],
  ['pontos', 'Pontuação'],
  ['engajamento', 'Check-in e indicação'],
  ['interacoes', 'Interações'],
  ['desafios', 'Desafios'],
  ['campanhas', 'Campanhas'],
  ['produtos', 'Produtos'],
  ['conta', 'Minha conta'],
] as const;

export default async function ConfiguracoesPage() {
  const restaurant = await requirePaidRestaurant();
  const [interactions, rewards, challenges, units, promotions] = await Promise.all([
    prisma.interactionRule.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.reward.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { pointsCost: 'asc' } }),
    prisma.challenge.findMany({ where: { restaurantId: restaurant.id }, orderBy: { createdAt: 'asc' } }),
    prisma.unit.findMany({ where: { restaurantId: restaurant.id }, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] }),
    prisma.promotion.findMany({ where: { restaurantId: restaurant.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  const nowDate = new Date();
  const activeCount = units.filter((u) => u.active).length;
  const onboarding = !restaurant.onboardedAt;

  return (
    <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* Computador: menu lateral fixo ao rolar */}
      <aside className="sticky top-6 hidden lg:block">
        <nav aria-label="Seções" className="glass-panel-sm flex flex-col gap-0.5 p-2">
          {SECTIONS.map(([id, label], i) => (
            <a key={id} href={`#${id}`} className="nav-tab flex items-center gap-2.5 !px-3 !py-2 !text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-electric-600/10 text-[11px] font-bold text-electric-600">{i + 1}</span>
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 max-w-3xl space-y-6">
      {onboarding && (
        <div className="glass-panel p-6 text-center">
          <h1 className="mb-1 text-2xl font-extrabold text-primary">Pagamento confirmado!</h1>
          <p className="text-slate-600">Configure seu restaurante em poucos passos e comece a pontuar. O essencial: endereço, horários e ao menos um produto.</p>
        </div>
      )}

      <nav aria-label="Seções" className="chip-row lg:hidden">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="chip-link shrink-0">
            {label}
          </a>
        ))}
      </nav>

      <Section id="dados" n={1} title="Dados do estabelecimento">
        <BasicsForm defaults={{ name: restaurant.name }} />
      </Section>

      <Section id="identidade" n={2} title="Identidade da marca" hint="Como seu restaurante aparece para os clientes no app.">
        <IdentityForm
          defaults={{
            category: restaurant.category ?? '',
            instagram: restaurant.instagram ?? '',
            listed: restaurant.listed,
            logoUrl: imageUrl(restaurant.logoImageId),
            coverUrl: imageUrl(restaurant.coverImageId),
          }}
        />
      </Section>

      <Section id="unidades" n={3} title="Unidades" hint="Cada unidade tem endereço, horário, localização e link do Google próprios. Pontos, prêmios e desafios valem em todas.">
        <ul className="mb-5 space-y-3">
          {units.map((u) => (
            <li key={u.id} className="glass-inset p-3">
              <details open={units.length === 1 || onboarding}>
                <summary className="flex cursor-pointer items-center justify-between gap-3 py-1">
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-slate-800">{u.name}</span>
                    <span className="block truncate text-xs text-slate-500">{u.address || 'Endereço não informado'}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {u.active ? 'Ativa' : 'Inativa'}
                  </span>
                </summary>
                <div className="mt-4 space-y-4 border-t border-slate-200/70 pt-4">
                  <UnitForm
                    uid={`u${u.id.slice(0, 8)}-`}
                    unit={{
                      id: u.id,
                      name: u.name,
                      address: u.address ?? '',
                      cep: u.cep ?? '',
                      street: u.street ?? u.address ?? '',
                      number: u.number ?? '',
                      complement: u.complement ?? '',
                      district: u.district ?? '',
                      city: u.city ?? '',
                      state: u.state ?? '',
                      googleReviewUrl: u.googleReviewUrl ?? '',
                      latitude: u.latitude,
                      longitude: u.longitude,
                      active: u.active,
                      schedule: u.openingSchedule,
                    }}
                  />
                  {(!u.active || activeCount > 1) && (
                    <form action={removeUnit} className="border-t border-slate-200/70 pt-4">
                      <input type="hidden" name="id" value={u.id} />
                      <button className="btn-danger btn-sm" aria-label={`Remover unidade ${u.name}`}>Remover unidade</button>
                      <p className="mt-1 text-xs text-slate-500">Se a unidade já tem histórico de lançamentos, ela apenas é desativada.</p>
                    </form>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>

        <details className="glass-inset p-3" open={false}>
          <summary className="link-inline cursor-pointer text-sm">+ Adicionar outra unidade</summary>
          <div className="mt-4 border-t border-slate-200/70 pt-4">
            <UnitForm
              uid="unew-"
              unit={{ id: null, name: '', address: '', cep: '', street: '', number: '', complement: '', district: '', city: '', state: '', googleReviewUrl: '', latitude: null, longitude: null, active: true, schedule: null }}
            />
          </div>
        </details>
      </Section>

      <Section id="pontos" n={4} title="Conversão e segurança" hint="Quanto cada real vale em pontos e quantos resgates cada CPF pode fazer por mês.">
        <RulesForm defaults={{ pointsPerReal: restaurant.pointsPerReal, maxRedeemsPerMonth: restaurant.maxRedeemsPerMonth }} />
      </Section>

      <Section id="engajamento" n={5} title="Check-in e indicação de amigos" hint="Dois jeitos de fazer o cliente voltar e trazer gente nova.">
        <EngagementForm defaults={{ checkInPoints: restaurant.checkInPoints, referralPoints: restaurant.referralPoints }} />
      </Section>

      <Section id="interacoes" n={6} title="Interações que dão pontos" hint="Pontuação fixa, marcada pelo caixa no lançamento (avaliação no Google, story no Instagram…).">
        <ul className="mb-4 divide-y divide-slate-200/70">
          {interactions.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhuma interação cadastrada.</li>}
          {interactions.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-slate-800">{i.label}</span>
              <span className="flex items-center gap-2">
                <span className="glass-chip">+{formatPoints(i.points)} pts</span>
                <RemoveButton action={removeInteraction} id={i.id} label={i.label} />
              </span>
            </li>
          ))}
        </ul>
        <AddInteractionForm />
      </Section>

      <Section id="desafios" n={7} title="Desafios da casa" hint="Metas que dão pontos de bônus automaticamente, como “2 compras acima de R$ 42 na semana”.">
        <ul className="mb-4 divide-y divide-slate-200/70">
          {challenges.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhum desafio criado.</li>}
          {challenges.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-slate-800">{describeChallenge(c)}</span>
              <span className="flex items-center gap-2">
                <span className="glass-chip">+{formatPoints(c.bonusPoints)} pts</span>
                <RemoveButton action={removeChallenge} id={c.id} label={c.title} />
              </span>
            </li>
          ))}
        </ul>
        <AddChallengeForm />
      </Section>

      <Section id="campanhas" n={8} title="Campanhas de pontos" hint="Pontos em dobro na terça, +50 pontos acima de R$ 40… Valem no caixa e aparecem como card na vitrine dos clientes.">
        <ul className="mb-4 space-y-3">
          {promotions.length === 0 && (
            <li>
              <EmptyState compact variant="coin" title="Nenhuma campanha ainda" text="Crie a primeira: pontos em dobro na terça, bônus para quem volta… Ela vira um card na vitrine dos clientes." />
            </li>
          )}
          {promotions.map((p) => {
            const status = promoStatus(p, nowDate);
            const look = { now: ['Valendo agora', 'bg-emerald-100 text-emerald-700'], scheduled: ['Agendada', 'bg-blue-100 text-electric-600'], paused: ['Pausada', 'bg-slate-200 text-slate-600'], ended: ['Encerrada', 'bg-slate-200 text-slate-500'] }[status];
            return (
              <li key={p.id} className="glass-inset p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{p.title}</p>
                    <p className="text-xs text-slate-500">{promoWhen(p, formatBRL)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="glass-chip">{promoBadge(p)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${look[1]}`}>{look[0]}</span>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  {status !== 'ended' && (
                    <form action={togglePromotion}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="glass-button-ghost btn-sm">{p.active ? 'Pausar' : 'Retomar'}</button>
                    </form>
                  )}
                  <RemoveButton action={removePromotion} id={p.id} label={p.title} />
                </div>
              </li>
            );
          })}
        </ul>
        <AddPromotionForm />
      </Section>

      <Section id="produtos" n={9} title="Produtos resgatáveis" hint="Itens do cardápio que o cliente pode trocar por pontos. Com foto, o resgate vende mais.">
        <ul className="mb-4 space-y-3">
          {rewards.length === 0 && <li className="py-2 text-sm text-slate-500">Cadastre ao menos um produto.</li>}
          {rewards.map((r) => (
            <li key={r.id} className="glass-inset p-3">
              <div className="flex items-center gap-3">
                <RewardImage src={imageUrl(r.imageId)} name={r.name} className="h-14 w-14 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{r.name}</p>
                  {r.description && <p className="truncate text-xs text-slate-500">{r.description}</p>}
                </div>
                <span className="glass-chip shrink-0">{formatPoints(r.pointsCost)} pts</span>
                <RemoveButton action={removeReward} id={r.id} label={r.name} />
              </div>
              <details className="mt-2">
                <summary className="link-inline inline-block text-sm">{r.imageId ? 'Trocar foto' : 'Adicionar foto'}</summary>
                <RewardPhotoForm id={r.id} currentUrl={imageUrl(r.imageId)} />
              </details>
            </li>
          ))}
        </ul>
        <AddRewardForm />
      </Section>

      <Section id="conta" n={10} title="Minha conta" hint="Troque a senha de acesso ao painel. Use uma senha que só você conheça.">
        <PasswordForm />
      </Section>

      {onboarding && (
        <div id="finalizar" className="glass-panel scroll-mt-4 p-5 sm:p-7">
          <FinishOnboardingForm />
        </div>
      )}
      </div>
    </div>
  );
}
