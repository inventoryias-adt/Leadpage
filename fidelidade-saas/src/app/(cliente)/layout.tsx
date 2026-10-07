import { CustomerNav } from '@/components/CustomerNav';

/** Moldura do app do cliente. Celular: coluna única + barra de abas embaixo. Computador: barra no topo e conteúdo em largura de tela. */
export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerNav />
      <div className="mx-auto min-h-screen w-full max-w-md pb-32 md:max-w-5xl md:pb-16">{children}</div>
    </>
  );
}
