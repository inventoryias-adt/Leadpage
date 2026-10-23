import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BirthdayCard } from '@/components/BirthdayCard';
import { CampaignTile } from '@/components/CampaignTile';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { CheckInButton } from '@/components/CheckInButton';
import { JaFizButton } from '@/components/JaFizButton';
import { CopyButton } from '@/components/CopyButton';
import { Icon, type IconName } from '@/components/Icons';
import { OpeningHours } from '@/components/OpeningHours';
import { ShareButtons } from '@/components/ShareButtons';
import { PlaceAvatar, ProgressBar, RewardImage } from '@/components/Visual';
import { RatingBadge, Stars } from '@/components/Stars';
import { categoryLabel } from '@/lib/categories';
import { challengeCount } from '@/lib/claims';
import { describeChallenge, periodRange } from '@/lib/challenges';
import { claimBirthdayPerkAction } from '@/app/actions/birthday-perk';
import { isBirthdayToday, perkCondition } from '@/lib/birthday-perk';
import { perkRedemptionThisYear } from '@/lib/birthday-perk-db';
import { prisma } from '@/lib/db';
import { ensureDefaultService } from '@/lib/booking-db';
import { isOpenNow, parseSchedule, todayLabel } from '@/lib/hours';
import { imageUrl } from '@/lib/images';
import { appUrl } from '@/lib/payments';
import { formatBRL, formatPoints, formatPrice } from '@/lib/points';
import { promoColor } from '@/lib/palette';
import { promoActiveAt, promoBig, promoStatus, promoWhen } from '@/lib/promos';
import { getCustomer } from '@/lib/session';
import { displayName, formatAvg } from '@/lib/reviews';
import { placeReviews, placeSummaries } from '@/lib/reviews-db';
import { placePhotos } from '@/lib/posts-db';
import { postPhotoPath } from '@/lib/posts';
import { brandOf } from '@/lib/palette';
import { INTERACTION_COOLDOWN_DAYS, releaseText } from '@/lib/interaction-approval';
import { settleDueInteractions } from '@/lib/interaction-claims';
import { newReferralCode } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } }).catch(() => null);
  return { title: r?.name ?? 'Lugar' };
}

/** Escolhe ícone e botão de cada ação conforme o texto cadastrado pelo restaurante. */
function actionMeta(label: string, r: { googleReviewUrl: string | null; instagram: string | null }) {
  const t = label.toLowerCase();
  if (/google|avalia/.test(t)) {
    return { icon: 'star' as IconName, cta: r.googleReviewUrl ? { href: r.googleReviewUrl, text: 'Avaliar no Google' } : null, copy: null as string | null };
  }
  if (/instagram|story|stories|foto|post|marc/.test(t)) {
    // O cliente copia o @ do lugar para marcar na foto (ou abre o perfil).
    return {
      icon: 'camera' as IconName,
      cta: r.instagram ? { href: `https://instagram.com/${r.instagram}`, text: 'Abrir Instagram' } : null,
      copy: r.instagram ? `@${r.instagram}` : null,
    };
  }
  return { icon: 'spark' as IconName, cta: null, copy: null as string | null };
}

export default async function LugarPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ bemvindo?: string; unidade?: string; presente?: string }>;
}) {
  const { restaurantId } = await params;
  const sp = await searchParams;
  const welcome = sp.bemvindo === '1';
  if (!/^[0-9a-f-]{36}$/.test(restaurantId)) notFound();

  const customer = await getCustomer();
  // Pedidos "Já fiz" em modo automático que já passaram do prazo entram antes de mostrar o saldo e o estado de cada interação.
  if (customer) await settleDueInteractions({ customerId: customer.id, restaurantId }).catch(() => 0);
  const [restaurant, rewards, challenges, rules, wallet, completions, units, promotions, serviceCount, menuCount] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId } }),
    prisma.reward.findMany({ where: { restaurantId, active: true, birthdayOnly: false }, orderBy: { pointsCost: 'asc' } }),
    prisma.challenge.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.interactionRule.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } }),
    customer ? prisma.wallet.findUnique({ where: { customerId_restaurantId: { customerId: customer.id, restaurantId } } }) : null,
    customer ? prisma.challengeCompletion.findMany({ where: { customerId: customer.id, challenge: { restaurantId } } }) : [],
    prisma.unit.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.promotion.findMany({ where: { restaurantId, active: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { createdAt: 'desc' } }),
    prisma.service.count({ where: { restaurantId, active: true } }),
    prisma.menuItem.count({ where: { restaurantId, active: true } }),
  ]);
  // Último pedido "Já fiz" do cliente em cada interação deste lugar (para mostrar "em análise", "aprovado"…).
  const [ratingMap, reviews, photos] = await Promise.all([placeSummaries([restaurantId]), placeReviews(restaurantId, 10), customer ? placePhotos(restaurantId, 6) : null]);
  const rating = ratingMap.get(restaurantId);
  const claimRows = customer ? await prisma.interactionClaim.findMany({ where: { customerId: customer.id, restaurantId }, orderBy: { createdAt: 'desc' }, take: 40 }) : [];
  const lastClaim = new Map<string, (typeof claimRows)[number]>();
  for (const c of claimRows) if (c.ruleId && !lastClaim.has(c.ruleId)) lastClaim.set(c.ruleId, c);
  const nowDate = new Date();
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt) notFound();
  // Barbearia, estética etc. sem nenhum serviço cadastrado: já oferece o serviço padrão, para o cliente poder agendar.
  const canBook = serviceCount > 0 || (await ensureDefaultService(restaurant));

  const progress = await Promise.all(
    challenges.map(async (c) => {
      const count = customer ? await challengeCount(prisma, c, customer.id, restaurantId) : 0;
      const key = periodRange(c.period).key;
      return { ...c, count, done: completions.some((x) => x.challengeId === c.id && x.periodKey === key) };
    }),
  );

  // Link de convite do cliente (código criado na primeira vez que ele precisa).
  let referralUrl: string | null = null;
  if (customer && restaurant.referralPoints > 0) {
    let code = customer.referralCode;
    if (!code) {
      code = newReferralCode();
      await prisma.customer.update({ where: { id: customer.id }, data: { referralCode: code } }).catch(() => {});
    }
    referralUrl = `${appUrl()}/convite/${restaurantId}/${code}`;
  }

  // Unidade em destaque: a escolhida no link (?unidade=) ou a primeira. Endereço, horário, mapa e Google vêm dela.
  const unit = units.find((u) => u.id === sp.unidade) ?? units[0] ?? null;
  const multi = units.length > 1;
  const schedule = parseSchedule(unit?.openingSchedule);
  const open = schedule ? isOpenNow(schedule) : null;
  const balance = wallet?.balance ?? 0;
  // Presente de aniversário: só no dia do aniversário do cliente e se o lugar oferece.
  const perkOffered = !!customer && isBirthdayToday(customer) && restaurant.birthdayPerkOn && !!restaurant.birthdayPerkTitle;
  const perkGot = perkOffered && customer ? await perkRedemptionThisYear(customer.id, restaurantId) : null;
  const perkCond = perkCondition({ mode: restaurant.birthdayPerkMode, points: restaurant.birthdayPerkPoints, minCents: restaurant.birthdayPerkMinCents });
  const perkShort = restaurant.birthdayPerkMode === 'POINTS' && balance < restaurant.birthdayPerkPoints;
  const hasCoords = units.some((u) => u.latitude != null && u.longitude != null); // check-in vale em qualquer unidade com localização
  // Resumos que aparecem nas seções fechadas (Ações, Campanhas e Desafios).
  const pts = (n: number) => `${formatPoints(n)} ${n === 1 ? 'pt' : 'pts'}`;
  const actionPoints = [restaurant.checkInPoints, restaurant.referralPoints, ...rules.map((r) => r.points)].filter((n) => n > 0);
  const actionsSummary = actionPoints.length ? `${actionPoints.length} ${actionPoints.length === 1 ? 'jeito' : 'jeitos'} de ganhar · até +${pts(Math.max(...actionPoints))}` : 'Toda compra já gera pontos';
  const shownPromos = promotions.filter((p) => promoStatus(p, nowDate) !== 'ended');
  const livePromos = shownPromos.filter((p) => promoActiveAt(p, nowDate)).length;
  const promosSummary = `${shownPromos.length} ${shownPromos.length === 1 ? 'campanha' : 'campanhas'}${livePromos ? ` · ${livePromos} valendo agora` : ''}`;
  const doneChallenges = customer ? progress.filter((c) => c.done).length : 0;
  const challengesSummary = progress.length
    ? `${progress.length} ${progress.length === 1 ? 'desafio' : 'desafios'} · bônus de até +${pts(Math.max(...progress.map((c) => c.bonusPoints)))}${doneChallenges ? ` · ${doneChallenges} ${doneChallenges === 1 ? 'concluído' : 'concluídos'}` : ''}`
    : 'Toda compra gera pontos';
  const directions = unit?.latitude != null && unit.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${unit.latitude},${unit.longitude}`
    : unit?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(unit.address)}`
      : null;
  const cover = imageUrl(restaurant.coverImageId);
  const brand = brandOf(restaurant.brandColor);
  const here = `/lugar/${restaurantId}`;

  return (
    <main className="brand-scope" style={{ ['--brand' as string]: brand.hex }}>
      {/* Capa */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-200 sm:rounded-b-3xl md:mt-4 md:h-60 md:rounded-3xl">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${brand.hex} 0%, ${brand.deep} 100%)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 to-transparent" />
        <Link href="/lugares" aria-label="Voltar para Lugares" className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/95 text-slate-800 shadow-sm transition-colors hover:bg-slate-100">
          <Icon name="back" size={20} />
        </Link>
      </div>

      <div className="-mt-10 space-y-6 px-4 pb-4 sm:px-6">
        {/* Cabeçalho */}
        <section className="glass-panel p-4">
          <div className="flex items-center gap-3.5">
            <PlaceAvatar name={restaurant.name} src={imageUrl(restaurant.logoImageId)} size={64} />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900">{restaurant.name}</h1>
              <p className="truncate text-sm text-slate-500">{[categoryLabel(restaurant.category, restaurant.categoryOther), multi ? unit?.name : null, unit?.address].filter(Boolean).join(' · ')}</p>
              {restaurant.tagline && <p className="mt-0.5 text-sm font-semibold" style={{ color: brand.hex }} data-testid="place-tagline">{restaurant.tagline}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {open != null && (
              <span className={open ? 'chip-verde' : 'glass-chip !bg-slate-100 !text-slate-600'}>
                {open ? 'Aberto agora' : 'Fechado agora'}
              </span>
            )}
            <RatingBadge summary={rating} className="!text-sm" />
            {schedule && <span className="flex items-center gap-1 text-slate-600"><Icon name="clock" size={15} /> {todayLabel(schedule).replace('Hoje: ', 'Hoje ')}</span>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {restaurant.ordersEnabled && menuCount > 0 && units.length > 0 && (
              <Link href={`${here}/pedido${multi && unit ? `?unidade=${unit.id}` : ''}`} className="glass-button-navy" data-testid="make-order">
                <Icon name="bag" size={17} /> Fazer pedido
              </Link>
            )}
            {canBook && units.length > 0 && (
              <Link href={`${here}/agendar${multi && unit ? `?unidade=${unit.id}` : ''}`} className="glass-button-navy">
                <Icon name="clock" size={17} /> Agendar
              </Link>
            )}
            {directions && (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="glass-button-ghost">
                <Icon name="pin" size={17} /> Como chegar
              </a>
            )}
            {wallet && (
              <Link href={`/mensagens/${restaurantId}`} className="glass-button-ghost" data-testid="chat-open">
                <Icon name="chat" size={17} /> Conversar
              </Link>
            )}
          </div>
        </section>

        {multi && (
          <nav aria-label="Unidades" className="chip-row">
            {units.map((u) => {
              const on = u.id === unit?.id;
              return (
                <Link
                  key={u.id}
                  href={`${here}?unidade=${u.id}`}
                  scroll={false}
                  aria-current={on ? 'true' : undefined}
                  className={`${on ? 'glass-button' : 'glass-button-ghost'} shrink-0 !w-auto !rounded-md !px-4 !py-1.5 !text-sm`}
                >
                  <Icon name="pin" size={14} /> {u.name}
                </Link>
              );
            })}
          </nav>
        )}

        {welcome && (
          <p role="status" className="glass-success">
            Conta criada! Depois de pagar a conta, informe o seu CPF no caixa (ou leia o QR Code) para começar a ganhar pontos aqui.
          </p>
        )}

        <div className="space-y-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-6 lg:col-span-3">
        {perkOffered && (
          <section aria-label="Presente de aniversário" data-testid="birthday-perk" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-extrabold text-amber-900">🎂 Feliz aniversário! {restaurant.name} tem um presente para você</p>
            <p className="mt-1 text-base font-bold text-ink">{restaurant.birthdayPerkTitle}</p>
            <p className="text-sm text-slate-700">{perkCond[0].toUpperCase() + perkCond.slice(1)}. Vale só hoje, uma vez por ano. Seus pontos de compra continuam sendo somados normalmente.</p>
            {sp.presente && <p role="alert" className="glass-error mt-2">{sp.presente}</p>}
            {perkGot ? (
              <p className="mt-3 text-sm font-semibold text-amber-900" data-testid="birthday-perk-done">
                {perkGot.status === 'USED' ? 'Presente já aproveitado. Bom apetite!' : <>Presente garantido! Mostre o código <b>{perkGot.code}</b> no caixa, <Link href={`/carteira/${restaurantId}`} className="underline">ver na carteira</Link>.</>}
              </p>
            ) : perkShort ? (
              <p className="mt-3 text-sm text-slate-700" data-testid="birthday-perk-short">Faltam {formatPoints(restaurant.birthdayPerkPoints - balance)} pts para trocar por este presente.</p>
            ) : (
              <form action={claimBirthdayPerkAction} className="mt-3">
                <input type="hidden" name="restaurantId" value={restaurantId} />
                <button type="submit" className="glass-button-lime btn-sm !w-auto px-5" data-testid="birthday-perk-claim">Quero meu presente</button>
              </form>
            )}
          </section>
        )}
        {customer && customer.birthDay == null && <BirthdayCard initial={null} giftPoints={restaurant.birthdayPoints} placeName={restaurant.name} />}

        {/* Saldo / entrar */}
        {customer ? (
          <section className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl bg-primary p-5">
            <div aria-hidden className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-lima/20 blur-2xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Seu saldo aqui</p>
              <p className="text-4xl font-extrabold text-lima">{formatPoints(balance)} <span className="text-base font-semibold text-slate-200">pts</span></p>
            </div>
            <Link href={`${here}/premios`} className="glass-button-lime btn-sm relative">
              <Icon name="gift" size={16} /> Escolher prêmio
            </Link>
          </section>
        ) : (
          <section className="glass-panel p-4 text-center">
            <p className="font-bold text-slate-800">Entre para ver seus pontos</p>
            <p className="mb-3 text-sm text-slate-600">Entre com e-mail e senha ou crie sua conta em um minuto.</p>
            <Link href={`/entrar?next=${encodeURIComponent(here)}`} className="glass-button">Entrar</Link>
          </section>
        )}

        {/* Ações da unidade */}
        <CollapsibleSection id="acoes" icon="star" title="Ações para ganhar pontos" summary={actionsSummary}>
          <ul className="glass-panel-sm divide-y divide-slate-200/70 overflow-hidden">
            {restaurant.checkInPoints > 0 && (
              <li className="hover-tint p-4">
                <div className="flex items-start gap-3">
                  <span className="icon-tile"><Icon name="pin" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-800">Check-in no local</p>
                      <span className="chip-soft">+{restaurant.checkInPoints} {restaurant.checkInPoints === 1 ? 'pt' : 'pts'}</span>
                    </div>
                    <p className="text-sm text-slate-500">Uma vez por dia, estando no local.</p>
                    {customer && hasCoords && <div className="mt-3"><CheckInButton restaurantId={restaurantId} points={restaurant.checkInPoints} /></div>}
                    {customer && !hasCoords && <p className="mt-2 text-xs text-slate-500">O estabelecimento ainda não configurou a localização.</p>}
                  </div>
                </div>
              </li>
            )}
            {rules.map((r) => {
              const meta = actionMeta(r.label, { googleReviewUrl: unit?.googleReviewUrl ?? null, instagram: restaurant.instagram });
              return (
                <li key={r.id} className="hover-tint p-4">
                  <div className="flex items-start gap-3">
                    <span className="icon-tile"><Icon name={meta.icon} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-800">{r.label}</p>
                        <span className="chip-soft shrink-0">+{formatPoints(r.points)} pts</span>
                      </div>
                      {(() => {
                        const last = lastClaim.get(r.id);
                        const cooldownOver = last?.status === 'APPROVED' && Date.now() - last.createdAt.getTime() > INTERACTION_COOLDOWN_DAYS * 24 * 3_600_000;
                        if (r.approval === 'COUNTER') return <p className="text-sm text-slate-500">Faça e mostre ao caixa para receber os pontos.</p>;
                        if (last?.status === 'PENDING') return <p className="mt-1"><span className="glass-chip" data-testid="claim-pending">Em análise{last.autoAt ? ` · ${releaseText(last.autoAt)}` : ''}</span></p>;
                        if (last?.status === 'APPROVED' && !cooldownOver) return <p className="mt-1"><span className="chip-verde">Pontos recebidos</span></p>;
                        return (
                          <>
                            <p className="text-sm text-slate-500">Faça e toque em <b>Já fiz</b>. {r.approval === 'AUTO' ? 'Os pontos entram sozinhos em até 24 h.' : 'O lugar confere e libera os seus pontos.'}</p>
                            {last?.status === 'REJECTED' && <p className="mt-1 text-xs font-semibold text-rose-600">O último pedido não foi confirmado pelo lugar.</p>}
                          </>
                        );
                      })()}
                      {(meta.copy || meta.cta) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {meta.copy && <CopyButton text={meta.copy} label={`Copiar ${meta.copy}`} copiedLabel="Copiado! Cole na sua foto" />}
                          {meta.cta && <a href={meta.cta.href} target="_blank" rel="noopener noreferrer" className="glass-button-ghost btn-sm">{meta.cta.text}</a>}
                        </div>
                      )}
                      {customer && r.approval !== 'COUNTER' && (() => {
                        const last = lastClaim.get(r.id);
                        const blocked = last?.status === 'PENDING' || (last?.status === 'APPROVED' && Date.now() - last.createdAt.getTime() <= INTERACTION_COOLDOWN_DAYS * 24 * 3_600_000);
                        return blocked ? null : <div className="mt-3"><JaFizButton ruleId={r.id} restaurantId={restaurantId} /></div>;
                      })()}
                    </div>
                  </div>
                </li>
              );
            })}
            {restaurant.referralPoints > 0 && (
              <li className="hover-tint p-4">
                <div className="flex items-start gap-3">
                  <span className="icon-tile"><Icon name="users" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-800">Indique amigos</p>
                      <span className="chip-soft shrink-0">+{formatPoints(restaurant.referralPoints)} pts</span>
                    </div>
                    <p className="text-sm text-slate-500">Você ganha quando seu amigo faz a primeira compra aqui.</p>
                    <div className="mt-3">
                      {referralUrl ? (
                        <ShareButtons url={referralUrl} text={`Entra no clube de pontos do ${restaurant.name} comigo e ganhe prêmios:`} />
                      ) : (
                        <Link href={`/entrar?next=${encodeURIComponent(here)}`} className="glass-button-ghost btn-sm">Entrar para pegar meu link</Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )}
            {rules.length === 0 && restaurant.checkInPoints <= 0 && restaurant.referralPoints <= 0 && (
              <li className="p-4 text-sm text-slate-500">Este lugar ainda não cadastrou ações extras. Toda compra já gera pontos.</li>
            )}
          </ul>
        </CollapsibleSection>

        {/* Prêmios */}
        <section aria-labelledby="premios">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="premios" className="text-xs font-bold uppercase tracking-wider text-slate-500">Troque seus pontos</h2>
            {rewards.length > 0 && <Link href={`${here}/premios`} className="link-inline text-sm">Ver todos</Link>}
          </div>
          {rewards.length === 0 ? (
            <p className="glass-panel-sm p-4 text-sm text-slate-500">Os prêmios deste lugar aparecem aqui em breve.</p>
          ) : (
            <ul className="space-y-3">
              {rewards.slice(0, 5).map((r) => {
                const missing = r.pointsCost - balance;
                return (
                  <li key={r.id}>
                    <Link href={`${here}/premios`} className="glass-panel-sm card-link flex items-center gap-3.5 p-3.5">
                      <RewardImage src={imageUrl(r.imageId)} name={r.name} className="h-16 w-16 shrink-0 rounded-2xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-800">{r.name}</p>
                        <p className="text-sm font-semibold text-electric-600">{formatPrice(r.pointsCost, r.cashCents)}</p>
                        {customer && (missing > 0 ? (
                          <div className="mt-1.5">
                            <ProgressBar value={balance} max={r.pointsCost} label={`Progresso para ${r.name}`} />
                            <p className="mt-1 text-xs text-slate-500">{formatPoints(balance)} / {formatPoints(r.pointsCost)} pts · faltam {formatPoints(missing)}</p>
                          </div>
                        ) : (
                          <span className="chip-lima mt-1.5">Você já pode resgatar</span>
                        ))}
                      </div>
                      <Icon name="chevron" size={18} className="shrink-0 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        </div>
        <div className="space-y-6 lg:col-span-2">
        {shownPromos.length > 0 && (
          <CollapsibleSection id="promocoes" icon="spark" title="Campanhas de pontos" summary={promosSummary}>
            <ul className="space-y-2">
              {shownPromos.map((p) => (
                <li key={p.id}>
                  <CampaignTile compact big={promoBig(p)} title={p.title} when={promoWhen(p, formatBRL)} color={promoColor(p)} live={promoActiveAt(p, nowDate)} />
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* Desafios */}
        <CollapsibleSection id="desafios" icon="trophy" title="Desafios da casa" summary={challengesSummary}>
          <ul className="space-y-2">
            <li className="hover-tint flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
              <span className="flex items-center gap-3 font-semibold text-slate-800"><span className="icon-tile"><Icon name="target" /></span> Toda compra aqui</span>
              <span className="chip-soft">{restaurant.pointsPerReal} pts a cada R$ 1</span>
            </li>
            {progress.map((c) => (
              <li key={c.id} className="hover-tint space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-start gap-3 font-semibold text-slate-800"><span className="icon-tile"><Icon name="trophy" /></span><span className="pt-2">{describeChallenge(c)}</span></span>
                  <span className="chip-soft shrink-0">+{formatPoints(c.bonusPoints)} pts</span>
                </div>
                {customer ? (
                  c.done ? (
                    <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-600"><Icon name="check" size={16} /> Desafio concluído {c.period === 'WEEK' ? 'nesta semana' : 'neste mês'}</p>
                  ) : (
                    <>
                      <ProgressBar value={c.count} max={c.target} label="Progresso do desafio" />
                      <p className="text-xs text-slate-500">{Math.min(c.count, c.target)} de {c.target} {c.period === 'WEEK' ? 'nesta semana' : 'neste mês'}</p>
                    </>
                  )
                ) : (
                  <p className="text-xs text-slate-500">Entre para acompanhar o seu progresso.</p>
                )}
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        {/* Avaliações */}
        {reviews.length > 0 && rating && (
          <CollapsibleSection id="avaliacoes" icon="star" title="Avaliações" summary={rating.ranked && rating.avg != null ? `★ ${formatAvg(rating.avg)} · ${rating.count} avaliações` : `${rating.count} ${rating.count === 1 ? 'avaliação' : 'avaliações'} (a nota aparece com 3)`}>
            <ul className="space-y-2.5" data-testid="place-reviews">
              {reviews.map((rv) => (
                <li key={rv.id} className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-3.5" data-testid="place-review">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><Stars value={rv.placeRating} size={15} /> {displayName(rv.customer.name)}</span>
                    <span className="text-xs text-slate-500">{rv.createdAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  {rv.staffRating && rv.resource && <p className="flex items-center gap-2 text-xs text-slate-600"><Stars value={rv.staffRating} size={13} /> {rv.resource.name}</p>}
                  {rv.comment && <p className="whitespace-pre-line text-sm text-slate-700">{rv.comment}</p>}
                  {rv.ownerReply && (
                    <p className="whitespace-pre-line rounded-xl bg-slate-50 p-2.5 text-sm text-slate-700"><span className="block text-xs font-bold text-slate-500">Resposta do lugar</span>{rv.ownerReply}</p>
                  )}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {restaurant.about && (
          <section aria-labelledby="sobre" data-testid="place-about">
            <h2 id="sobre" className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Sobre nós</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{restaurant.about}</p>
          </section>
        )}

        {/* Fotos dos clientes: o que os clientes postaram marcando este lugar */}
        {photos && (photos.total > 0 || wallet) && (
          <CollapsibleSection id="fotos" icon="camera" title="Fotos dos clientes" summary={photos.total > 0 ? `${photos.total} ${photos.total === 1 ? 'foto' : 'fotos'} de clientes` : 'Seja o primeiro a postar'} defaultOpen>
            {photos.total > 0 ? (
              <ul className="grid grid-cols-3 gap-1.5" data-testid="place-photos">
                {photos.items.map((ph) => (
                  <li key={ph.id} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                    <Link href={`/indicacoes?lugar=${restaurantId}`} aria-label={`Foto de cliente, ${ph.rating} estrelas, ${ph.likes} curtidas`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={postPhotoPath(ph.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-900/70 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-bold text-white"><span>★ {ph.rating}</span><span>♥ {ph.likes}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600" data-testid="place-photos-empty">Ainda não há fotos de clientes aqui.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.total > 0 && <Link href={`/indicacoes?lugar=${restaurantId}`} className="glass-button-ghost btn-sm !w-auto px-4" data-testid="place-photos-all">Ver todas as fotos</Link>}
              {wallet && <Link href={`/indicacoes/nova?lugar=${restaurantId}`} className="glass-button-lime btn-sm !w-auto px-4" data-testid="place-photos-new"><Icon name="camera" size={15} /> Postar uma foto daqui</Link>}
            </div>
          </CollapsibleSection>
        )}

        {/* Horários */}
        {schedule && (
          <section aria-labelledby="horarios">
            <h2 id="horarios" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Horário de funcionamento</h2>
            <OpeningHours schedule={schedule} title={multi && unit ? `Quando você pode vir · ${unit.name}` : 'Quando você pode vir'} />
          </section>
        )}
        </div>
        </div>
      </div>
    </main>
  );
}
