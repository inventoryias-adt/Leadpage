import { formatPoints } from './points';

type Goal = { name: string; pointsCost: number };

/**
 * Frase de meta para o aviso de pontos: prêmio recém-liberado ou quanto falta para o próximo.
 * `rewards` são os prêmios ativos do lugar, em qualquer ordem.
 */
export function goalText(before: number, after: number, rewards: Goal[]): string | null {
  const sorted = [...rewards].sort((a, b) => a.pointsCost - b.pointsCost);
  const unlocked = sorted.filter((r) => r.pointsCost > before && r.pointsCost <= after).pop();
  if (unlocked) return `Agora você já pode resgatar ${unlocked.name}!`;
  const next = sorted.find((r) => r.pointsCost > after);
  if (!next) return null;
  const missing = next.pointsCost - after;
  return `Faltam ${formatPoints(missing)} ${missing === 1 ? 'ponto' : 'pontos'} para ${next.name}.`;
}

export function pointsTitle(points: number, place: string) {
  return `+${formatPoints(points)} ${points === 1 ? 'ponto' : 'pontos'} · ${place}`;
}
