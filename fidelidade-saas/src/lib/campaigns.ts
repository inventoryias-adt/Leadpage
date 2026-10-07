import { describeChallenge, type ChallengeLike } from './challenges';
import { CHECKIN_RADIUS_M } from './geo';
import { formatBRL } from './points';
import { promoActiveAt, promoBadge, promoStatus, promoWhen, type PromoLike } from './promos';

/** Campanha de pontos em andamento num lugar (vira um card na vitrine). */
export type CampaignItem = {
  id: string;
  kind: 'desafio' | 'checkin' | 'indicacao' | 'promocao';
  title: string;
  points: number;
  /** Texto grande do card quando não é "+N pts" (ex.: "2x pontos"). */
  badge?: string;
  /** Campanha do dono valendo neste momento. */
  live?: boolean;
  how: string;
  /** Seção da página do lugar onde o cliente participa. */
  anchor: 'acoes' | 'desafios';
};

type Source = {
  challenges: (ChallengeLike & { id: string; bonusPoints: number })[];
  checkInPoints: number;
  hasCoords: boolean;
  referralPoints: number;
  promotions?: (PromoLike & { id: string })[];
  now?: Date;
};

/** Reúne o que está valendo agora: desafios ativos, check-in e indicação de amigos. */
export function buildCampaigns(restaurantId: string, s: Source): CampaignItem[] {
  const out: CampaignItem[] = s.challenges.map((c) => ({
    id: c.id,
    kind: 'desafio',
    title: describeChallenge(c),
    points: c.bonusPoints,
    how: `Cumpra a meta ${c.period === 'WEEK' ? 'dentro da semana (segunda a domingo)' : 'dentro do mês'} e o bônus entra sozinho na sua carteira. Vale uma vez por ${c.period === 'WEEK' ? 'semana' : 'mês'}.`,
    anchor: 'desafios',
  }));
  const now = s.now ?? new Date();
  const promos = (s.promotions ?? [])
    .filter((p) => promoStatus(p, now) !== 'ended' && promoStatus(p, now) !== 'paused')
    .map<CampaignItem>((p) => ({
      id: p.id,
      kind: 'promocao',
      title: p.title,
      points: p.kind === 'BONUS' ? (p.bonusPoints ?? 0) : 0,
      badge: promoBadge(p),
      live: promoActiveAt(p, now),
      how: `${promoWhen(p, formatBRL)}. Os pontos saem sozinhos, com a campanha já aplicada, quando o caixa lançar a sua compra.`,
      anchor: 'acoes',
    }));
  out.unshift(...promos);
  if (s.checkInPoints > 0 && s.hasCoords) {
    out.push({
      id: `${restaurantId}-checkin`,
      kind: 'checkin',
      title: 'Check-in no local',
      points: s.checkInPoints,
      how: `Chegue a até ${CHECKIN_RADIUS_M} m do lugar, toque em “Fazer check-in” e ganhe os pontos. Vale uma vez por dia.`,
      anchor: 'acoes',
    });
  }
  if (s.referralPoints > 0) {
    out.push({
      id: `${restaurantId}-indicacao`,
      kind: 'indicacao',
      title: 'Indique um amigo',
      points: s.referralPoints,
      how: 'Mande o seu link para um amigo. Quando ele fizer a primeira compra aqui, os pontos caem na sua carteira.',
      anchor: 'acoes',
    });
  }
  return out;
}
