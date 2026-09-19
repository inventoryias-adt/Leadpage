import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '../../../lib/db';
import type { UserSettings } from '../../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getSettings());
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function validate(body: unknown): { ok: true; value: UserSettings } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Corpo inválido.' };
  const b = body as Record<string, unknown>;

  if (!isPositiveNumber(b.bankroll) || b.bankroll <= 0) return { ok: false, error: 'Banca deve ser um número positivo.' };
  if (!isPositiveNumber(b.stakePercent) || b.stakePercent <= 0 || b.stakePercent > 100)
    return { ok: false, error: 'Percentual de stake deve estar entre 0 e 100.' };
  if (!isPositiveNumber(b.maxStake) || b.maxStake <= 0) return { ok: false, error: 'Stake máxima deve ser positiva.' };
  if (!isPositiveNumber(b.profitTarget)) return { ok: false, error: 'Meta de lucro inválida.' };
  if (!isPositiveNumber(b.minProbability) || b.minProbability > 1)
    return { ok: false, error: 'Probabilidade mínima deve estar entre 0 e 1.' };
  if (!isPositiveNumber(b.minOdd) || b.minOdd < 1) return { ok: false, error: 'Odd mínima deve ser >= 1.' };
  if (!isPositiveNumber(b.maxOdd) || b.maxOdd < b.minOdd) return { ok: false, error: 'Odd máxima deve ser >= odd mínima.' };
  if (b.maxLegsMultiple !== 2 && b.maxLegsMultiple !== 3)
    return { ok: false, error: 'Máximo de seleções na múltipla deve ser 2 ou 3.' };

  return {
    ok: true,
    value: {
      bankroll: b.bankroll,
      stakePercent: b.stakePercent,
      maxStake: b.maxStake,
      profitTarget: b.profitTarget,
      minProbability: b.minProbability,
      minOdd: b.minOdd,
      maxOdd: b.maxOdd,
      maxLegsMultiple: b.maxLegsMultiple
    }
  };
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const result = validate(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const saved = saveSettings(result.value);
  return NextResponse.json(saved);
}
