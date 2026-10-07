import { removeChallenge, removeInteraction, removeReward } from '@/app/actions/restaurant';
import {
  AddChallengeForm,
  AddInteractionForm,
  AddRewardForm,
  BasicsForm,
  EngagementForm,
  FinishOnboardingForm,
  IdentityForm,
  RewardPhotoForm,
  RulesForm,
} from '@/components/SettingsForms';
import { HoursForm } from '@/components/HoursForm';
import { RewardImage } from '@/components/Visual';
import { describeChallenge } from '@/lib/challenges';
import { prisma } from '@/lib/db';
import { defaultSchedule, parseSchedule } from '@/lib/hours';
import { imageUrl } from '@/lib/images';
import { formatPoints } from '@/lib/points';
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
  ['dados', 'Dados'],
  ['identidade', 'Identidade e local'],
  ['horarios', 'Horários'],
  ['pontos', 'Pontuação'],
  ['engajamento', 'Check-in e indicação'],
  ['interacoes', 'Interações'],
  ['desafios', 'Desafios'],
  ['produtos', 'Produtos'],
] as const;

export default async function ConfiguracoesPage() {
  const restaurant = await requirePaidRestaurant();
  const [interactions, rewards, challenges] = await Promise.all([
    prisma.interactionRule.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.reward.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { pointsCost: 'asc' } }),
    prisma.challenge.findMany({ where: { restaurantId: restaurant.id }, orderBy: { createdAt: 'asc' } }),
  ]);
  const onboarding = !restaurant.onboardedAt;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {onboarding && (
        <div className="glass-panel p-6 text-center">
          <h1 className="mb-1 text-2xl font-extrabold text-primary">Pagamento confirmado!</h1>
          <p className="text-slate-600">Configure seu restaurante em poucos passos e comece a pontuar. O essencial: endereço, horários e ao menos um produto.</p>
        </div>
      )}

      <nav aria-label="Seções" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="chip-link shrink-0">
            {label}
          </a>
        ))}
      </nav>

      <Section id="dados" n={1} title="Dados do estabelecimento">
        <BasicsForm defaults={{ name: restaurant.name, address: restaurant.address ?? '' }} />
      </Section>

      <Section id="identidade" n={2} title="Identidade e localização" hint="Como seu restaurante aparece para os clientes no app, e onde ele fica no mapa.">
        <IdentityForm
          defaults={{
            category: restaurant.category ?? '',
            instagram: restaurant.instagram ?? '',
            googleReviewUrl: restaurant.googleReviewUrl ?? '',
            latitude: restaurant.latitude,
            longitude: restaurant.longitude,
            listed: restaurant.listed,
            logoUrl: imageUrl(restaurant.logoImageId),
            coverUrl: imageUrl(restaurant.coverImageId),
          }}
        />
      </Section>

      <Section id="horarios" n={3} title="Horário de funcionamento" hint="Aparece para o cliente quando ele resgata pontos: é quando ele pode ir retirar o prêmio.">
        <HoursForm initial={parseSchedule(restaurant.openingSchedule) ?? defaultSchedule()} />
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

      <Section id="produtos" n={8} title="Produtos resgatáveis" hint="Itens do cardápio que o cliente pode trocar por pontos. Com foto, o resgate vende mais.">
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

      {onboarding && (
        <div className="glass-panel p-5 sm:p-7">
          <FinishOnboardingForm />
        </div>
      )}
    </div>
  );
}
