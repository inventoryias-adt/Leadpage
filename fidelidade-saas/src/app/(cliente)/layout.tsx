import { CustomerNav } from '@/components/CustomerNav';
import { unreadCount } from '@/lib/notifications';
import { getCustomer } from '@/lib/session';

/** Moldura do app do cliente. Celular: coluna única + barra de abas embaixo. Computador: barra no topo e conteúdo em largura de tela. */
export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer();
  const unread = customer ? await unreadCount(customer.id) : 0;
  return (
    <>
      <CustomerNav unread={unread} />
      <div className="mx-auto min-h-screen w-full max-w-md pb-32 md:max-w-5xl md:pb-16">{children}</div>
    </>
  );
}
