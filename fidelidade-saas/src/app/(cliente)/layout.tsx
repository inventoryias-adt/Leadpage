import { CustomerNav } from '@/components/CustomerNav';

/** Moldura do app do cliente: conteúdo em coluna de celular + barra de abas fixa embaixo. */
export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto min-h-screen w-full max-w-md pb-32">{children}</div>
      <CustomerNav />
    </>
  );
}
