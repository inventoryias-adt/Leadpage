import { maskCpf, formatPhone } from '@/lib/br';
import { toCsv } from '@/lib/csv';
import { prisma } from '@/lib/db';
import { loadCustomerRows } from '@/lib/insights-db';
import { SEGMENT_LABEL } from '@/lib/insights';
import { formatBRL, formatDateTimeBR } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const dynamic = 'force-dynamic';

const file = (name: string, body: string) =>
  new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });

/** Exporta clientes ou lançamentos em CSV (abre direto no Excel). Só do estabelecimento logado. */
export async function GET(_: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const { tipo } = await params;

  if (tipo === 'clientes') {
    const { rows } = await loadCustomerRows(restaurant.id);
    const cpfs = new Map(
      (await prisma.customer.findMany({ where: { id: { in: rows.map((r) => r.customerId) } }, select: { id: true, cpf: true } })).map((c) => [c.id, c.cpf]),
    );
    return file(
      'clientes',
      toCsv(
        ['Nome', 'CPF', 'Telefone', 'Saldo (pts)', 'Compras', 'Última compra', 'Cliente desde', 'Grupos'],
        rows
          .sort((a, b) => b.balance - a.balance)
          .map((r) => [
            r.name,
            maskCpf(cpfs.get(r.customerId) ?? ''),
            formatPhone(r.phone),
            r.balance,
            r.purchases,
            r.lastPurchaseAt ? formatDateTimeBR(r.lastPurchaseAt) : '',
            formatDateTimeBR(r.createdAt),
            r.segments.map((s) => SEGMENT_LABEL[s]).join(', '),
          ]),
      ),
    );
  }

  if (tipo === 'lancamentos') {
    const since = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000);
    const claims = await prisma.claim.findMany({
      where: { restaurantId: restaurant.id, redeemedAt: { gte: since } },
      orderBy: { redeemedAt: 'desc' },
      take: 20000,
      select: { redeemedAt: true, amountCents: true, points: true, description: true, customer: { select: { name: true } }, unit: { select: { name: true } } },
    });
    return file(
      'lancamentos',
      toCsv(
        ['Data', 'Cliente', 'Valor da compra', 'Pontos', 'Descrição', 'Unidade'],
        claims.map((c) => [c.redeemedAt ? formatDateTimeBR(c.redeemedAt) : '', c.customer?.name ?? '', c.amountCents > 0 ? formatBRL(c.amountCents) : '', c.points, c.description, c.unit?.name ?? '']),
      ),
    );
  }

  return new Response('Não encontrado', { status: 404 });
}
