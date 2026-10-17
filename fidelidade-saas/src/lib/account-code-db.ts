import 'server-only';
import { prisma } from './db';
import { newAccountCode } from './tokens';

/** Um ID que ninguém usa ainda (a colisão é rara: 32^6 combinações, mas confere antes de gravar). */
export async function uniqueAccountCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = newAccountCode();
    if (!(await prisma.customer.findUnique({ where: { accountCode: code }, select: { id: true } }))) return code;
  }
  return newAccountCode();
}

/** O ID do cliente; contas anteriores ao recurso (ou criadas fora do cadastro) ganham o ID na primeira vez que ele é pedido. */
export async function ensureAccountCode(customer: { id: string; accountCode: string | null }): Promise<string> {
  if (customer.accountCode) return customer.accountCode;
  const code = await uniqueAccountCode();
  const done = await prisma.customer.updateMany({ where: { id: customer.id, accountCode: null }, data: { accountCode: code } });
  if (done.count) return code;
  return (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id }, select: { accountCode: true } })).accountCode ?? code;
}
