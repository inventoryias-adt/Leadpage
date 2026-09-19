import { NextResponse } from 'next/server';
import { deleteEntry, updateEntryStatus } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['win', 'loss', 'void'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const status = (body as Record<string, unknown> | null)?.status;
  if (typeof status !== 'string' || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: 'Status deve ser win, loss ou void.' }, { status: 400 });
  }

  const updated = updateEntryStatus(params.id, status as 'win' | 'loss' | 'void');
  if (!updated) {
    return NextResponse.json({ error: 'Entrada não encontrada.' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const ok = deleteEntry(params.id);
  if (!ok) return NextResponse.json({ error: 'Entrada não encontrada.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
