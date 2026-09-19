import { NextResponse } from 'next/server';
import { listEntries } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const entries = listEntries();
  const headers = [
    'id',
    'createdAt',
    'type',
    'description',
    'odd',
    'impliedProbability',
    'modelProbability',
    'edge',
    'expectedValue',
    'score',
    'stake',
    'potentialReturn',
    'potentialProfit',
    'status',
    'settledAt',
    'profitLoss'
  ];

  const rows = entries.map((e) =>
    [
      e.id,
      e.createdAt,
      e.type,
      e.description,
      e.odd,
      e.impliedProbability,
      e.modelProbability,
      e.edge,
      e.expectedValue,
      e.score,
      e.stake,
      e.potentialReturn,
      e.potentialProfit,
      e.status,
      e.settledAt ?? '',
      e.profitLoss ?? ''
    ]
      .map(csvEscape)
      .join(';')
  );

  const csv = [headers.join(';'), ...rows].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sports-operator-historico-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`
    }
  });
}
