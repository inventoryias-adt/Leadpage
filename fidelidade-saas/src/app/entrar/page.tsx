import { redirect } from 'next/navigation';
import { Brand } from '@/components/Brand';
import { CustomerAuthForm } from '@/components/AuthForms';
import { InstallApp } from '@/components/InstallApp';
import { safeNext } from '@/lib/form';
import { getCustomer } from '@/lib/session';

export const metadata = { title: 'Minha carteira' };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, '/carteira');
  if (await getCustomer()) redirect(next);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-5">
      <InstallApp className="w-full max-w-md" />
      <div className="glass-panel w-full max-w-md p-8">
        <div className="mb-6"><Brand href="/entrar" /></div>
        <h1 className="mb-1 text-2xl font-bold text-primary">Minha carteira de pontos</h1>
        <p className="mb-6 text-sm text-slate-500">Entre com seu e-mail e senha ou crie sua conta em um minuto.</p>
        <CustomerAuthForm next={next} cta="Entrar" />
      </div>
    </main>
  );
}
