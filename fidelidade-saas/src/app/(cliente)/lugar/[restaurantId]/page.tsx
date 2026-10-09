import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckInButton } from '@/components/CheckInButton';
import { Icon, type IconName } from '@/components/Icons';
import { OpeningHours } from '@/components/OpeningHours';
import { ShareButtons } from '@/components/ShareButtons';
import { PlaceAvatar, ProgressBar, RewardImage } from '@/components/Visual';
import { categoryLabel } from '@/lib/categories';
import { challengeCount } from '@/lib/claims';
import { describeChallenge, periodRange } from '@/lib/challenges';
import { prisma } from '@/lib/db';
import { isOpenNow, parseSchedule, todayLabel } from '@/lib/hours';
import { imageUrl } from '@/lib/images';
import { appUrl } from '@/lib/payments';
import { formatBRL, formatPoints, formatPrice } from '@/lib/points';
import { promoActiveAt, promoBadge, promoStatus, promoWhen } from '@/lib/promos';
import { getCustomer } from '@/lib/session';
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
    return { icon: 'star' as IconName, cta: r.googleReviewUrl ? { href: r.googleReviewUrl, text: 'Avaliar no Google' } : null };
  }
  if (/instagram|story|stories|foto|post|marc/.test(t)) {
    return { icon: 'camera' as IconName, cta: r.instagram ? { href: `https://instagram.com/${r.instagram}`, text: `Abrir @${r.instagram}` } : null };
  }
  return { icon: 'spark' as IconName, cta: null };
}

export default async function LugarPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ bemvindo?: string; unidade?: string }>;
}) {
  const { restaurantId } = await params;
  const sp = await searchParams;
  const welcome = sp.bemvindo === '1';
  if (!/^[0-9a-f-]{36}$/.test(restaurantId)) notFound();

  const customer = await getCustomer();
  const [restaurant, rewards, challenges, rules, wallet, completions, units, promotions] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId } }),
    prisma.reward.findMany({ where: { restaurantId, active: true }, orderBy: { pointsCost: 'asc' } }),
    prisma.challenge.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.interactionRule.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } }),
    customer ? prisma.wallet.findUnique({ where: { customerId_restaurantId: { customerId: customer.id, restaurantId } } }) : null,
    customer ? prisma.challengeCompletion.findMany({ where: { customerId: customer.id, challenge: { restaurantId } } }) : [],
    prisma.unit.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.promotion.findMany({ where: { restaurantId, active: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { createdAt: 'desc' } }),
  ]);
  const nowDate = new Date();
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt) notFound();

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
  const hasCoords = units.some((u) => u.latitude != null && u.longitude != null); // check-in vale em qualquer unidade com localização
  const directions = unit?.latitude != null && unit.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${unit.latitude},${unit.longitude}`
    : unit?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(unit.address)}`
      : null;
  const cover = imageUrl(restaurant.coverImageId);
  const here = `/lugar/${restaurantId}`;

  return (
    <main>
      {/* Capa */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-200 sm:rounded-b-3xl md:mt-4 md:h-60 md:rounded-3xl">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: 'linear-gradient(135deg, #0F1F3D 0%, #1A3FA3 100%)' }} />
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
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {open != null && (
              <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {open ? 'Aberto agora' : 'Fechado agora'}
              </span>
            )}
            {schedule && <span className="flex items-center gap-1 text-slate-600"><Icon name="clock" size={15} /> {todayLabel(schedule).replace('Hoje: ', 'Hoje ')}</span>}
          </div>
          {directions && (
            <a href={directions} target="_blank" rel="noopener noreferrer" className="glass-button-ghost btn-sm mt-3">
              <Icon name="pin" size={16} /> Como chegar
            </a>
          )}
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
            Conta criada! Depois de pagar a conta, peça o QR Code no caixa para começar a ganhar pontos aqui.
          </p>
        )}

        <div className="space-y-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-6 lg:col-span-3">
        {/* Saldo / entrar */}
        {customer ? (
          <section className="glass-panel flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seu saldo aqui</p>
              <p className="text-3xl font-extrabold text-primary">{formatPoints(balance)} <span className="text-base text-electric-600">pts</span></p>
            </div>
            <Link href={`${here}/premios`} className="glass-button btn-sm">
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
        <section aria-labelledby="acoes">
          <h2 id="acoes" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Ações para ganhar pontos</h2>
          <ul className="glass-panel-sm divide-y divide-slate-200/70">
            {restaurant.checkInPoints > 0 && (
              <li className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-600/10 text-electric-600"><Icon name="pin" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-800">Check-in no local</p>
                      <span className="glass-chip">+{restaurant.checkInPoints} {restaurant.checkInPoints === 1 ? 'pt' : 'pts'}</span>
                    </div>
                    <p className="text-sm text-slate-500">Uma vez por dia, estando no restaurante.</p>
                    {customer && hasCoords && <div className="mt-3"><CheckInButton restaurantId={restaurantId} points={restaurant.checkInPoints} /></div>}
                    {customer && !hasCoords && <p className="mt-2 text-xs text-slate-500">O restaurante ainda não configurou a localização.</p>}
                  </div>
                </div>
              </li>
            )}
            {rules.map((r) => {
              const meta = actionMeta(r.label, { googleReviewUrl: unit?.googleReviewUrl ?? null, instagram: restaurant.instagram });
              return (
                <li key={r.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-600/10 text-electric-600"><Icon name={meta.icon} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-800">{r.label}</p>
                        <span className="glass-chip shrink-0">+{formatPoints(r.points)} pts</span>
                      </div>
                      <p className="text-sm text-slate-500">Faça e mostre ao caixa para receber os pontos.</p>
                      {meta.cta && (
                        <a href={meta.cta.href} target="_blank" rel="noopener noreferrer" className="glass-button-ghost btn-sm mt-3">{meta.cta.text}</a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {restaurant.referralPoints > 0 && (
              <li className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-600/10 text-electric-600"><Icon name="users" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-800">Indique amigos</p>
                      <span className="glass-chip shrink-0">+{formatPoints(restaurant.referralPoints)} pts</span>
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
        </section>

        {/* Prêmios */}
        <section aria-labelledby="premios">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="premios" className="text-xs font-bold uppercase tracking-wider text-slate-500">Troque seus pontos</h2>
            {rewards.length > 0 && <Link href={`${here}/premios`} className="link-inline text-sm">Ver todos</Link>}
          </div>
          {rewards.length === 0 ? (
            <p className="glass-panel-sm p-4 text-sm text-slate-500">Os prêmios deste lugar aparecem aqui em breve.</p>
          ) : (
            <ul className="card-row">
              {rewards.slice(0, 8).map((r) => {
                const missing = r.pointsCost - balance;
                return (
                  <li key={r.id}>
                    <Link href={`${here}/premios`} className="glass-panel-sm card-link block overflow-hidden">
                      <RewardImage src={imageUrl(r.imageId)} name={r.name} className="h-28 w-full" />
                      <div className="space-y-1.5 p-3">
                        <p className="truncate text-sm font-bold text-slate-800">{r.name}</p>
                        <p className="text-sm font-semibold text-electric-600">{formatPrice(r.pointsCost, r.cashCents)}</p>
                        {customer && (missing > 0 ? (
                          <>
                            <ProgressBar value={balance} max={r.pointsCost} label={`Progresso para ${r.name}`} />
                            <p className="text-[11px] text-slate-500">faltam {formatPoints(missing)} pts</p>
                          </>
                        ) : (
                          <p className="text-[11px] font-bold text-emerald-600">Você já pode resgatar</p>
                        ))}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        </div>
        <div className="space-y-6 lg:col-span-2">
        {promotions.length > 0 && (
          <section aria-labelledby="promocoes">
            <h2 id="promocoes" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Campanhas de pontos</h2>
            <ul className="space-y-3">
              {promotions.filter((p) => promoStatus(p, nowDate) !== 'ended').map((p) => (
                <li key={p.id} className="glass-panel-sm space-y-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-start gap-3 font-semibold text-slate-800"><Icon name="spark" className="mt-0.5 text-amber-500" /> {p.title}</span>
                    <span className="glass-chip shrink-0">{promoBadge(p)}</span>
                  </div>
                  <p className="text-sm text-slate-600">{promoWhen(p, formatBRL)}</p>
                  {promoActiveAt(p, nowDate) && <p className="text-xs font-bold text-emerald-600">Valendo agora</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Desafios */}
        <section aria-labelledby="desafios">
          <h2 id="desafios" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Desafios da casa</h2>
          <ul className="space-y-3">
            <li className="glass-panel-sm flex items-center justify-between gap-3 p-4">
              <span className="flex items-center gap-3 font-semibold text-slate-800"><Icon name="target" className="text-electric-600" /> Toda compra aqui</span>
              <span className="glass-chip">{restaurant.pointsPerReal} pts a cada R$ 1</span>
            </li>
            {progress.map((c) => (
              <li key={c.id} className="glass-panel-sm space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-start gap-3 font-semibold text-slate-800"><Icon name="trophy" className="mt-0.5 text-amber-500" /> {describeChallenge(c)}</span>
                  <span className="glass-chip shrink-0">+{formatPoints(c.bonusPoints)} pts</span>
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
        </section>

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
