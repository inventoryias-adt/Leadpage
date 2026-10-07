import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/AuthForms';
import { getRestaurant } from '@/lib/session';

export const metadata = { title: 'Entrar' };

export default async function LoginPage() {
  if (await getRestaurant()) redirect('/dashboard');
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-panel w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-bold text-primary">Entrar no painel</h1>
        <p className="mb-6 text-sm text-slate-500">Acesso do restaurante.</p>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-slate-600">
          Ainda não tem conta? <Link href="/#assinar" className="font-semibold text-electric-600">Assinar</Link>
        </p>
      </div>
    </main>
  );
}
