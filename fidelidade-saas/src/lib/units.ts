import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from './db';
import { distanceMeters } from './geo';

export const UNIT_COOKIE = 'fz_unit';

export const DEFAULT_UNIT_NAME = 'Unidade principal';

/** Unidades ativas da marca, em ordem de criação (a primeira é a "principal"). */
export const activeUnits = (restaurantId: string) =>
  prisma.unit.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } });

/**
 * Unidade em que ESTE aparelho está operando (caixa). Fica num cookie escolhido no cabeçalho do painel;
 * se não houver escolha válida, usa a primeira unidade ativa.
 */
export async function currentUnit(restaurantId: string) {
  const units = await activeUnits(restaurantId);
  const chosen = (await cookies()).get(UNIT_COOKIE)?.value;
  const unit = units.find((u) => u.id === chosen) ?? units[0] ?? null;
  return { unit, units };
}

/** Unidade (com coordenadas) mais perto de um ponto, e a distância em metros. */
export function nearestUnit<T extends { latitude: number | null; longitude: number | null }>(units: T[], at: { lat: number; lng: number }) {
  let best: { unit: T; meters: number } | null = null;
  for (const unit of units) {
    if (unit.latitude == null || unit.longitude == null) continue;
    const meters = distanceMeters(at, { lat: unit.latitude, lng: unit.longitude });
    if (!best || meters < best.meters) best = { unit, meters };
  }
  return best;
}
