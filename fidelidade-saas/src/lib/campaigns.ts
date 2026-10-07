import { describeChallenge, type ChallengeLike } from './challenges';
import { CHECKIN_RADIUS_M } from './geo';

/** Campanha de pontos em andamento num lugar (vira um card na vitrine). */
export type CampaignItem = {
  id: string;
  kind: 'desafio' | 'checkin' | 'indicacao';
  title: string;
  points: number;
  how: string;
  /** Seção da página do lugar onde o cliente participa. */
  anchor: 'acoes' | 'desafios';
};

type Source = {
  challenges: (ChallengeLike & { id: string; bonusPoints: number })[];
  checkInPoints: number;
  hasCoords: boolean;
  referralPoints: number;
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
