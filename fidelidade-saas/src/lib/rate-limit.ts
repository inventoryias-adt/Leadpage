import 'server-only';
import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from './db';

/** IP do cliente (atrás de proxy/Vercel o primeiro item de x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}

/**
 * Conta uma tentativa para `key` numa janela fixa. Atômico (um único upsert).
 * Retorna true se ainda está dentro do limite.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const resetAt = new Date(Date.now() + windowSeconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count"`);
  return rows[0].count <= limit;
}

export const TOO_MANY = 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
