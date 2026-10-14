import { setAppCampaign } from '@/app/actions/app-campaigns';
import { campaignBadge, campaignWhen } from '@/lib/app-campaigns';
import { removeChallenge, removeInteraction, removePromotion, removeReward, removeUnit, togglePromotion } from '@/app/actions/restaurant';
import {
  AddChallengeForm,
  AddPromotionForm,
  AddInteractionForm,
  AddRewardForm,
  BasicsForm,
  BillingPortalForm,
  EngagementForm,
  SharingForm,
  FinishOnboardingForm,
  IdentityForm,
  PasswordForm,
  RewardPhotoForm,
  RulesForm,
  UnitForm,
} from '@/components/SettingsForms';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icons';
import { PlaceAvatar, RewardImage } from '@/components/Visual';
import { describeChallenge } from '@/lib/challenges';
import { prisma } from '@/lib/db';
import { suggestsBooking } from '@/lib/categories';
import { getSupport } from '@/lib/support-env';
import { parseSchedule } from '@/lib/hours';
import { removeResource, removeService } from '@/app/actions/agenda';
import { AddServiceForm, BookingPolicyForm, StaffForm } from '@/components/AgendaSettings';
import { imageUrl } from '@/lib/images';
import { formatBRL, formatPoints, formatPrice } from '@/lib/points';
import { promoBadge, promoStatus, promoWhen } from '@/lib/promos';
import { requirePaidRestaurant } from '@/lib/session';

export const metadata = { title: 'Regras e configurações' };
export const dynamic = 'force-dynamic';

/** Etapa grande da configuração (numerada, aparece no menu). */
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
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** Bloco essencial dentro de uma etapa: sempre aberto. */
function Block({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-4 border-t border-slate-200/70 pt-5 first:border-0 first:pt-0">
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {hint && <p className="mb-3 text-sm text-slate-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}

/** Bloco opcional: abre sozinho quando já tem algo configurado (ou com ?abrir=tudo) e mostra o estado no título. */
function Optional({ id, title, hint, status, open, children }: { id: string; title: string; hint?: string; status: string; open: boolean; children: React.ReactNode }) {
  return (
    <details id={id} open={open} className="group scroll-mt-4 rounded-2xl border border-slate-200 bg-white/60 p-4 open:bg-white">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1 text-base font-bold leading-snug text-slate-800">{title}</span>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 group-open:bg-[#E8EEFB] group-open:text-electric-600">{status}</span>
          <Icon name="down" size={18} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </span>
        {hint && <span className="mt-1 block pr-8 text-sm text-slate-500">{hint}</span>}
      </summary>
      <div className="mt-4 border-t border-slate-200/70 pt-4">{children}</div>
    </details>
  );
}

function RemoveButton({ action, id, label }: { action: (fd: FormData) => Promise<void>; id: string; label: string }) {
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label={`Remover ${label}`} title="Remover">
        <Icon name="trash" size={18} />
      </button>
    </form>
  );
}

/** Linha de lista "texto + pontos + remover", sem espremer o texto no celular. */
function PointsRow({ text, points, remove }: { text: string; points: number; remove: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex h-10 min-w-[3.5rem] shrink-0 items-center justify-center rounded-lg bg-[#E8EEFB] px-2 text-sm font-bold tabular-nums text-electric-600">+{formatPoints(points)}</span>
      <span className="min-w-0 flex-1 text-sm leading-snug text-slate-800">{text}</span>
      {remove}
    </li>
  );
}

const SECTIONS = [
  ['negocio', 'Seu negócio'],
  ['regras', 'Ganhar pontos'],
  ['premios', 'Prêmios'],
  ['agenda', 'Agenda'],
  ['compartilhar', 'Rede de lugares'],
  ['conta', 'Minha conta'],
] as const;

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ abrir?: string }> }) {
  const restaurant = await requirePaidRestaurant();
  const abrir = (await searchParams).abrir;
  const abrirTudo = abrir === 'tudo';
  const [interactions, rewards, challenges, units, promotions, resources, services, appCampaigns] = await Promise.all([
    prisma.interactionRule.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.reward.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { pointsCost: 'asc' } }),
    prisma.challenge.findMany({ where: { restaurantId: restaurant.id }, orderBy: { createdAt: 'asc' } }),
    prisma.unit.findMany({ where: { restaurantId: restaurant.id }, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] }),
    prisma.promotion.findMany({ where: { restaurantId: restaurant.id }, orderBy: { createdAt: 'desc' } }),
    prisma.resource.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { createdAt: 'asc' }, include: { offers: true } }),
    prisma.service.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.appCampaign.findMany({ where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { createdAt: 'desc' } }),
  ]);
  const adopted = new Set(promotions.map((p) => p.appCampaignId).filter(Boolean));
  const nowDate = new Date();
  const activeCount = units.filter((u) => u.active).length;
  const onboarding = !restaurant.onboardedAt;
  const bookingSuggested = suggestsBooking(restaurant.category);
  const openAll = abrirTudo || onboarding; // no primeiro acesso mostramos tudo aberto

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

      {(() => {
        const steps = [
          { done: !!restaurant.logoImageId && !!restaurant.category, label: 'Logo e categoria do seu negócio', href: '#identidade' },
          { done: units.some((u) => u.active && !!u.address && u.latitude != null), label: 'Endereço, horário e localização no mapa', href: '#unidades' },
          { done: rewards.length > 0, label: 'Ao menos um prêmio para o cliente trocar por pontos', href: '#produtos' },
        ];
        const ready = steps.filter((x) => x.done).length;
        if (ready === steps.length && !onboarding) return null;
        return (
          <section aria-labelledby="comece" className="glass-panel p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="comece" className="text-base font-bold text-primary">Comece por aqui</h2>
              <span className="rounded-full bg-[#E8EEFB] px-3 py-1 text-xs font-bold text-electric-600">{ready} de {steps.length} prontos</span>
            </div>
            <ul className="space-y-2">
              {steps.map((x) => (
                <li key={x.href}>
                  <a href={x.href} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-slate-50">
                    <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${x.done ? 'bg-emerald-100 text-emerald-700' : 'border border-slate-300 text-slate-400'}`}>{x.done ? '✓' : ''}</span>
                    <span className={x.done ? 'text-slate-500 line-through' : 'font-semibold text-slate-800'}>{x.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">O resto é opcional e você pode configurar depois: campanhas, desafios, agenda e pontos compartilhados ficam logo abaixo.</p>
          </section>
        );
      })()}

      <Section id="negocio" n={1} title="Seu negócio" hint="Nome, marca, onde fica e quando abre. É o que o cliente vê no app.">
      <Block id="dados" title="Dados do estabelecimento">
        <BasicsForm defaults={{ name: restaurant.name }} />
      </Block>

      <Block id="identidade" title="Identidade da marca" hint="Como seu restaurante aparece para os clientes no app.">
        <IdentityForm
          placeName={restaurant.name}
          supportEnv={{ email: process.env.SUPPORT_EMAIL, whatsapp: process.env.SUPPORT_WHATSAPP }}
          defaults={{
            category: restaurant.category ?? '',
            categoryOther: restaurant.categoryOther ?? '',
            instagram: restaurant.instagram ?? '',
            listed: restaurant.listed,
            logoUrl: imageUrl(restaurant.logoImageId),
            coverUrl: imageUrl(restaurant.coverImageId),
          }}
        />
      </Block>

      <Block id="unidades" title="Unidades" hint="Cada unidade tem endereço, horário, localização e link do Google próprios. Pontos, prêmios e desafios valem em todas.">
        <ul className="mb-5 space-y-3">
          {units.map((u) => (
            <li key={u.id} className="glass-inset p-3">
              <details open={units.length === 1 || onboarding}>
                <summary className="flex cursor-pointer items-center justify-between gap-3 py-1">
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-slate-800">{u.name}</span>
                    <span className="block truncate text-xs text-slate-500">{u.address || 'Endereço não informado'}</span>
                  </span>
                  <span className={`shrink-0 rounded-md px-2.5 py-0.5 text-xs font-semibold ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
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
      </Block>
      </Section>

      <Section id="regras" n={2} title="Como o cliente ganha pontos" hint="O essencial é o primeiro bloco. Os outros são opcionais e abrem sozinhos quando você já configurou algo.">
      <Block id="pontos" title="Pontos por compra" hint="Quanto cada real vale em pontos e quantos resgates cada CPF pode fazer por mês.">
        <RulesForm defaults={{ pointsPerReal: restaurant.pointsPerReal, maxRedeemsPerMonth: restaurant.maxRedeemsPerMonth }} />
      </Block>

      <Optional id="engajamento" title="Check-in e indicação de amigos" hint="Dois jeitos de fazer o cliente voltar e trazer gente nova." status={restaurant.checkInPoints > 0 || restaurant.referralPoints > 0 ? `Ligado` : 'Opcional'} open={openAll || restaurant.checkInPoints > 0 || restaurant.referralPoints > 0}>
        <EngagementForm defaults={{ checkInPoints: restaurant.checkInPoints, referralPoints: restaurant.referralPoints }} />
      </Optional>

      <Optional id="interacoes" title="Interações que dão pontos" hint="Pontuação fixa, marcada pelo caixa no lançamento (avaliação no Google, story no Instagram…)." status={interactions.length > 0 ? `${interactions.length} ${interactions.length === 1 ? 'ativa' : 'ativas'}` : 'Opcional'} open={openAll || interactions.length > 0}>
        <ul className="mb-4 divide-y divide-slate-200/70">
          {interactions.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhuma interação cadastrada.</li>}
          {interactions.map((i) => (
            <PointsRow key={i.id} text={i.label} points={i.points} remove={<RemoveButton action={removeInteraction} id={i.id} label={i.label} />} />
          ))}
        </ul>
        <p className="mb-2 text-sm font-bold text-slate-800">Nova interação</p>
        <AddInteractionForm />
      </Optional>

      <Optional id="desafios" title="Desafios da casa" hint="Metas que dão pontos de bônus automaticamente, como “2 compras acima de R$ 42 na semana”." status={challenges.length > 0 ? `${challenges.length} ${challenges.length === 1 ? 'ativo' : 'ativos'}` : 'Opcional'} open={openAll || challenges.length > 0}>
        <ul className="mb-4 divide-y divide-slate-200/70">
          {challenges.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhum desafio criado.</li>}
          {challenges.map((c) => (
            <PointsRow key={c.id} text={describeChallenge(c)} points={c.bonusPoints} remove={<RemoveButton action={removeChallenge} id={c.id} label={c.title} />} />
          ))}
        </ul>
        <p className="mb-2 text-sm font-bold text-slate-800">Novo desafio</p>
        <AddChallengeForm />
      </Optional>

      <Optional id="campanhas" title="Campanhas de pontos" hint="Pontos em dobro na terça, +50 pontos acima de R$ 40… Valem no caixa e aparecem como card na vitrine dos clientes." status={promotions.length + appCampaigns.length > 0 ? `${promotions.length} ${promotions.length === 1 ? 'campanha' : 'campanhas'}` : 'Opcional'} open={openAll || promotions.length > 0}>
        {appCampaigns.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-bold text-slate-800">Campanhas do app</h3>
            <p className="mb-3 text-xs text-slate-500">O Fidelize propõe e você escolhe. Quem participa ganha a campanha no caixa e aparece para os clientes no app.</p>
            <ul className="space-y-3">
              {appCampaigns.map((c) => {
                const on = adopted.has(c.id);
                return (
                  <li key={c.id} className="glass-inset p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{c.title}</p>
                        {c.description && <p className="text-xs text-slate-600">{c.description}</p>}
                        <p className="text-xs text-slate-500">{campaignWhen(c)}</p>
                      </div>
                      <span className="glass-chip shrink-0">{campaignBadge(c)}</span>
                    </div>
                    <form action={setAppCampaign} className="mt-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="join" value={on ? '0' : '1'} />
                      <button className={on ? 'glass-button-ghost btn-sm' : 'glass-button btn-sm'}>{on ? 'Participando · sair da campanha' : 'Participar da campanha'}</button>
                    </form>
                  </li>
                );
              })}
            </ul>
            <h3 className="mb-2 mt-6 text-sm font-bold text-slate-800">Suas campanhas</h3>
          </div>
        )}
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
                    <p className="font-semibold text-slate-800">{p.title}{p.appCampaignId && <span className="ml-2 rounded-full bg-[#E8EEFB] px-2 py-0.5 text-[11px] font-semibold text-electric-600">Campanha do app</span>}</p>
                    <p className="text-xs text-slate-500">{promoWhen(p, formatBRL)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="glass-chip">{promoBadge(p)}</span>
                    <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${look[1]}`}>{look[0]}</span>
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
      </Optional>
      </Section>

      <Section id="premios" n={3} title="Prêmios do clube" hint="O que o cliente pode trocar por pontos. Com foto, o resgate vende mais.">
      <Block id="produtos" title="Produtos resgatáveis">
        <ul className="mb-4 space-y-3">
          {rewards.length === 0 && <li className="py-2 text-sm text-slate-500">Cadastre ao menos um produto.</li>}
          {rewards.map((r) => (
            <li key={r.id} className="glass-inset p-3">
              <div className="flex items-start gap-3">
                <RewardImage src={imageUrl(r.imageId)} name={r.name} className="h-16 w-16 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-slate-800 [overflow-wrap:anywhere]">{r.name}</p>
                  {r.description && <p className="line-clamp-2 text-xs text-slate-500">{r.description}</p>}
                  <span className="glass-chip mt-1.5">{formatPrice(r.pointsCost, r.cashCents)}</span>
                </div>
                <RemoveButton action={removeReward} id={r.id} label={r.name} />
              </div>
              <RewardPhotoForm id={r.id} hasPhoto={!!r.imageId} name={r.name} edit={{ description: r.description ?? '', pointsCost: r.pointsCost, cashCents: r.cashCents }} />
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-dashed border-slate-300 p-4">
          <h4 className="mb-3 text-sm font-bold text-slate-800">Novo produto</h4>
          <AddRewardForm />
        </div>
      </Block>
      </Section>

      <Section id="agenda" n={4} title="Agenda e serviços" hint="Barbearia, clínica, salão, restaurante… O cliente marca pelo app e, quando o atendimento é concluído, os pontos entram sozinhos.">
      <Optional id="agenda-conteudo" title="Configurar a agenda" hint={bookingSuggested ? 'Seu tipo de negócio costuma atender com hora marcada: cadastre os serviços para o cliente agendar pelo app.' : 'Só se o seu negócio atende com hora marcada ou reserva.'} status={services.length > 0 ? `${services.length} ${services.length === 1 ? 'serviço' : 'serviços'}` : bookingSuggested ? 'Recomendado' : 'Opcional'} open={openAll || abrir === 'agenda' || bookingSuggested || services.length > 0}>
        <div className="space-y-7">
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Serviços</h3>
            <ul className="mb-4 space-y-2">
              {services.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhum serviço cadastrado. O horário de funcionamento de cada unidade (seção Unidades) define quando dá para marcar.</li>}
              {services.map((sv) => (
                <li key={sv.id} className="glass-inset flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{sv.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {sv.durationMin} min · {sv.priceCents > 0 ? formatBRL(sv.priceCents) : 'sem cobrança'}
                      {sv.askPartySize ? ' · reserva de mesa' : ''}
                      {sv.pointsDiscountMaxPct > 0 ? ` · aceita pontos (até ${sv.pointsDiscountMaxPct}%)` : ''}
                    </p>
                  </div>
                  <RemoveButton action={removeService} id={sv.id} label={sv.name} />
                </li>
              ))}
            </ul>
            <AddServiceForm />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Equipe e vagas</h3>
            <ul className="mb-4 space-y-3">
              {resources.length === 0 && <li className="py-2 text-sm text-slate-500">Ao cadastrar o primeiro serviço criamos a vaga “Atendimento” (uma pessoa por vez). Cadastre cada profissional abaixo, com foto, dias e horários e o tempo de cada serviço.</li>}
              {resources.map((r) => {
                const sched = parseSchedule(r.schedule);
                const names = r.offers.map((o) => services.find((sv) => sv.id === o.serviceId)?.name).filter(Boolean);
                return (
                  <li key={r.id} className="glass-inset p-3">
                    <div className="flex items-center gap-3">
                      <PlaceAvatar name={r.name} src={imageUrl(r.photoImageId)} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-800">{r.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[
                            sched ? 'escala própria' : 'horário da unidade',
                            names.length ? `faz: ${names.join(', ')}` : 'faz todos os serviços',
                            r.capacity > 1 ? `${r.capacity} ao mesmo tempo` : null,
                            r.unitId ? units.find((u) => u.id === r.unitId)?.name : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <RemoveButton action={removeResource} id={r.id} label={r.name} />
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-electric-600">Editar</summary>
                      <div className="mt-3">
                        <StaffForm
                          uid={`st-${r.id.slice(0, 8)}`}
                          services={services.map((sv) => ({ id: sv.id, name: sv.name, durationMin: sv.durationMin }))}
                          units={units.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }))}
                          staff={{
                            id: r.id,
                            name: r.name,
                            email: r.email ?? '',
                            phone: r.phone ?? '',
                            capacity: r.capacity,
                            unitId: r.unitId ?? '',
                            schedule: sched,
                            photoUrl: imageUrl(r.photoImageId),
                            offers: Object.fromEntries(r.offers.map((o) => [o.serviceId, o.durationMin])),
                          }}
                        />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
            <details className="rounded-lg border border-dashed border-slate-300 p-3" open={resources.length === 0}>
              <summary className="cursor-pointer text-sm font-semibold text-electric-600">+ Adicionar profissional ou vaga</summary>
              <div className="mt-3">
                <StaffForm uid="st-novo" services={services.map((sv) => ({ id: sv.id, name: sv.name, durationMin: sv.durationMin }))} units={units.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }))} />
              </div>
            </details>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Regras de agendamento</h3>
            <BookingPolicyForm defaults={{ auto: restaurant.bookingAutoConfirm, minNotice: restaurant.bookingMinNoticeMin, maxAhead: restaurant.bookingMaxDaysAhead, cancelHours: restaurant.bookingCancelHours, pointsPerRealOff: restaurant.pointsPerRealOff, earnPerReal: restaurant.pointsPerReal, notifyEmail: restaurant.bookingNotifyEmail ?? '', accountEmail: restaurant.email }} />
          </div>
        </div>
      </Optional>
      </Section>

      <Section id="compartilhar" n={5} title="Pontos compartilhados" hint="Uma rede entre lugares: o cliente junta pontos em um e pode usar em outros que participam.">
        <SharingForm defaults={{ pointsShareOut: restaurant.pointsShareOut, pointsAcceptIn: restaurant.pointsAcceptIn }} />
      </Section>

      <Section id="conta" n={6} title="Minha conta" hint="Troque a senha de acesso ao painel. Use uma senha que só você conheça.">
        <PasswordForm />
        {restaurant.paymentCustomerId && <BillingPortalForm support={getSupport('Assinatura no Fidelize', `Olá! Sou do estabelecimento "${restaurant.name}" e não consegui abrir o gerenciamento da assinatura no Fidelize.`)} />}
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
