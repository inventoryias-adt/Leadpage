import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sendDueReminders } from '@/lib/booking-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Chamada de tempos em tempos (GitHub Actions a cada 5 min) com `Authorization: Bearer <CRON_SECRET>`. */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 });
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!same(given, secret)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await sendDueReminders()) });
  } catch (e) {
    console.error('[cron/lembretes]', e);
    return NextResponse.json({ error: 'Falha ao enviar lembretes.' }, { status: 500 });
  }
}

export { handle as GET, handle as POST };
