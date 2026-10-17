import { maskCpf } from '@/lib/br';
import { toCsv } from '@/lib/csv';
import { prisma } from '@/lib/db';
import { formatBRL, formatDateTimeBR } from '@/lib/points';
import { buildWhere, parseFilter } from '@/lib/redemption-filters';
import { requireActiveRestaurant } from '@/lib/session';

export const dynamic = 'force-dynamic';

const SITUACAO = { PENDING: 'A entregar', USED: 'Entregue' } as const;

/** Resgates em CSV (abre direto no Excel), com os mesmos filtros da tela: situação, período, unidade e busca. */
export async function GET(req: Request) {
  const restaurant = await requireActiveRestaurant();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const f = parseFilter(sp);
  const rows = await prisma.redemption.findMany({
    where: buildWhere(restaurant.id, f),
    orderBy: f.st === 'entregues' ? [{ usedAt: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
    take: 20000,
    include: { customer: { select: { name: true, cpf: true } }, usedUnit: { select: { name: true } } },
  });
  const body = toCsv(
    ['Código', 'Prêmio', 'Cliente', 'CPF', 'Situação', 'Resgatado em', 'Entregue em', 'Unidade da entrega', 'Pontos', 'Valor cobrado (R$)'],
    rows.map((r) => [r.code, r.rewardName, r.customer.name, maskCpf(r.customer.cpf), SITUACAO[r.status], formatDateTimeBR(r.createdAt), r.usedAt ? formatDateTimeBR(r.usedAt) : '', r.usedUnit?.name ?? '', r.pointsCost, r.cashCents > 0 ? formatBRL(r.cashCents) : '']),
  );
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="resgates-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
