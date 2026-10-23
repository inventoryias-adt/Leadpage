'use server';

import { dayDetail, slotDetail } from '@/lib/dash-detail';
import { dayReasons, slotTips, type DayDetail, type SlotDetail } from '@/lib/insights';
import { requireActiveRestaurant } from '@/lib/session';

export type DayView = { detail: DayDetail; reasons: string[] };
export type SlotView = { detail: SlotDetail; tips: string[] };

/** Detalhe de um dia do gráfico de vendas (só do estabelecimento logado). */
export async function loadDayDetail(ymd: string): Promise<DayView | null> {
  const restaurant = await requireActiveRestaurant();
  const detail = await dayDetail(restaurant.id, String(ymd));
  return detail ? { detail, reasons: dayReasons(detail) } : null;
}

/** Detalhe de um horário do mapa de calor. */
export async function loadSlotDetail(dow: number, hour: number): Promise<SlotView | null> {
  const restaurant = await requireActiveRestaurant();
  const found = await slotDetail(restaurant.id, Number(dow), Number(hour));
  return found ? { detail: found.slot, tips: slotTips(found.slot, found.best) } : null;
}
