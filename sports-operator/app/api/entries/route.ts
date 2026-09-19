import { NextResponse } from 'next/server';
import { createEntry, listEntries } from '../../../lib/db';
import type { EntryRecord, Opportunity } from '../../../lib/types';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await listEntries());
  } catch (err) {
    console.error('[api/entries] GET error:', err);
    return NextResponse.json({ error: 'Erro ao ler histórico do banco.' }, { status: 500 });
  }
}

function isValidOpportunity(v: unknown): v is Opportunity {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.type === 'string' &&
    Array.isArray(o.selections) &&
    typeof o.combinedOdd === 'number' &&
    typeof o.suggestedStake === 'number' &&
    typeof o.potentialReturn === 'number' &&
    typeof o.potentialProfit === 'number'
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || !('opportunity' in body)) {
    return NextResponse.json({ error: 'Campo "opportunity" ausente.' }, { status: 400 });
  }

  const opportunity = (body as Record<string, unknown>).opportunity;
  if (!isValidOpportunity(opportunity)) {
    return NextResponse.json({ error: 'Oportunidade inválida.' }, { status: 400 });
  }

  if (opportunity.type === 'no_bet') {
    return NextResponse.json({ error: 'Não é possível registrar uma oportunidade NO BET.' }, { status: 400 });
  }

  const description = opportunity.selections
    .map((s) => `${s.homeTeam} x ${s.awayTeam} — ${s.marketLabel}: ${s.outcomeName}`)
    .join(' | ');

  const entry: EntryRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    type: opportunity.type,
    description,
    odd: opportunity.combinedOdd,
    impliedProbability: opportunity.impliedProbability,
    modelProbability: opportunity.modelProbability,
    edge: opportunity.edge,
    expectedValue: opportunity.expectedValue,
    score: opportunity.score,
    stake: opportunity.suggestedStake,
    potentialReturn: opportunity.potentialReturn,
    potentialProfit: opportunity.potentialProfit,
    status: 'pending',
    settledAt: null,
    profitLoss: null,
    raw: JSON.stringify(opportunity)
  };

  try {
    await createEntry(entry);
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error('[api/entries] POST error:', err);
    return NextResponse.json({ error: 'Erro ao gravar entrada no banco.' }, { status: 500 });
  }
}
