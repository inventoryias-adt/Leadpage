import { removeInteraction, removeReward } from '@/app/actions/restaurant';
import {
  AddInteractionForm,
  AddRewardForm,
  BasicsForm,
  FinishOnboardingForm,
  RulesForm,
} from '@/components/SettingsForms';
import { prisma } from '@/lib/db';
import { formatPoints } from '@/lib/points';
import { defaultSchedule, parseSchedule } from '@/lib/hours';
import { HoursForm } from '@/components/HoursForm';
import { requirePaidRestaurant } from '@/lib/session';

export const metadata = { title: 'Regras e configurações' };
export const dynamic = 'force-dynamic';

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass-panel p-5 sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-electric-500 text-sm font-bold text-white">{n}</span>
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
      <button className="rounded-lg px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50" aria-label={`Remover ${label}`}>
        Remover
      </button>
    </form>
  );
}

export default async function ConfiguracoesPage() {
  const restaurant = await requirePaidRestaurant();
  const [interactions, rewards] = await Promise.all([
    prisma.interactionRule.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.reward.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { pointsCost: 'asc' } }),
  ]);
  const onboarding = !restaurant.onboardedAt;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {onboarding && (
        <div className="glass-panel p-6 text-center">
          <h1 className="mb-1 text-2xl font-extrabold text-primary">Pagamento confirmado! 🎉</h1>
          <p className="text-slate-600">Configure seu restaurante em 5 passos rápidos e comece a pontuar.</p>
        </div>
      )}

      <Section n={1} title="Dados do estabelecimento">
        <BasicsForm defaults={{ name: restaurant.name, address: restaurant.address ?? '' }} />
      </Section>

      <Section n={2} title="Horário de funcionamento" hint="Aparece para o cliente quando ele resgata pontos: é quando ele pode ir retirar o prêmio.">
        <HoursForm initial={parseSchedule(restaurant.openingSchedule) ?? defaultSchedule()} />
      </Section>

      <Section n={3} title="Conversão e segurança" hint="Quanto cada real vale em pontos e quantos resgates cada CPF pode fazer por mês.">
        <RulesForm defaults={{ pointsPerReal: restaurant.pointsPerReal, maxRedeemsPerMonth: restaurant.maxRedeemsPerMonth }} />
      </Section>

      <Section n={4} title="Interações que dão pontos" hint="Pontuação fixa, marcada pelo caixa no lançamento.">
        <ul className="mb-4 divide-y divide-white/60">
          {interactions.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhuma interação cadastrada.</li>}
          {interactions.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2">
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

      <Section n={5} title="Produtos resgatáveis" hint="Itens do cardápio que o cliente pode trocar por pontos.">
        <ul className="mb-4 divide-y divide-white/60">
          {rewards.length === 0 && <li className="py-2 text-sm text-slate-500">Cadastre ao menos um produto.</li>}
          {rewards.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-slate-800">{r.name}</span>
              <span className="flex items-center gap-2">
                <span className="glass-chip">{formatPoints(r.pointsCost)} pts</span>
                <RemoveButton action={removeReward} id={r.id} label={r.name} />
              </span>
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
