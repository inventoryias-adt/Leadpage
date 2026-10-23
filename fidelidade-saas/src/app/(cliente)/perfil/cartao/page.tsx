import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { CardBack, CardFront, PrintCard } from '@/components/MemberCard';
import { PrintButton } from '@/components/PrintButton';
import { prisma } from '@/lib/db';
import { requireCustomer } from '@/lib/session';
import { ensureAccountCode } from '@/lib/account-code-db';

export const metadata = { title: 'Imprimir cartão' };
export const dynamic = 'force-dynamic';

/** Cartão do cliente para imprimir (frente e verso, no tamanho de cartão de crédito). */
export default async function CartaoPage() {
  const customer = await requireCustomer('/perfil/cartao');
  const [accountCode, wallets] = await Promise.all([ensureAccountCode(customer), prisma.wallet.aggregate({ where: { customerId: customer.id }, _sum: { balance: true } })]);
  const data = {
    name: customer.name,
    code: accountCode,
    since: `${String(customer.createdAt.getMonth() + 1).padStart(2, '0')}/${String(customer.createdAt.getFullYear()).slice(2)}`,
    balance: wallets._sum.balance ?? 0,
  };
  return (
    <main className="space-y-6 p-4 sm:p-6 md:pt-8">
      <header>
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <Link href="/perfil" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-electric-600 md:mt-0">‹ Perfil</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Imprimir cartão</h1>
        <p className="text-sm text-slate-600">Frente e verso no tamanho de um cartão de crédito. O saldo impresso é o de hoje; o que vale no caixa é o ID da conta.</p>
      </header>
      <div className="mx-auto grid w-full max-w-3xl gap-5 sm:grid-cols-2" data-testid="card-preview">
        <div><CardFront data={data} /></div>
        <div><CardBack data={data} /></div>
      </div>
      <div className="flex justify-center"><PrintButton label="Imprimir cartão" /></div>
      <PrintCard data={data} />
    </main>
  );
}
