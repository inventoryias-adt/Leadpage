import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Brand } from '@/components/Brand';
import { Icon } from '@/components/Icons';
import { CustomerAuthForm } from '@/components/AuthForms';
import { InstallApp } from '@/components/InstallApp';
import { LegalLinks } from '@/components/LegalLinks';
import { safeNext } from '@/lib/form';
import { getCustomer } from '@/lib/session';

export const metadata = { title: 'Minha carteira' };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; criar?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '/carteira');
  if (await getCustomer()) redirect(next);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-5">
      <InstallApp className="w-full max-w-md" />
      <div className="glass-panel w-full max-w-md p-8">
        <div className="mb-6"><Brand href="/entrar" /></div>
        <h1 className="mb-1 text-2xl font-bold text-primary">Minha carteira de pontos</h1>
        <p className="mb-6 text-sm text-slate-500">Entre com seu e-mail e senha ou crie sua conta em um minuto.</p>
        <CustomerAuthForm next={next} cta="Entrar" initial={sp.criar ? 'criar' : 'entrar'} />
      </div>
      <Link href="/quero-o-fidelize?origem=qr" data-testid="sou-comerciante" className="flex w-full max-w-md items-center gap-3 rounded-3xl bg-primary p-4 text-white shadow-lg transition-transform hover:-translate-y-0.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#c6f432] text-primary"><Icon name="receipt" size={22} /></span>
        <span className="min-w-0 flex-1 text-sm leading-snug">
          <b className="block text-base">Tem um comércio?</b>
          <span className="text-slate-300">Quero o Fidelize no meu negócio</span>
        </span>
        <Icon name="chevron" size={20} className="shrink-0 text-[#c6f432]" />
      </Link>
      <LegalLinks audience="cliente" />
    </main>
  );
}
