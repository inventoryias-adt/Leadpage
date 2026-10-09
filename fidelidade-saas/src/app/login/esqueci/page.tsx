import { ForgotForm } from '@/components/AuthForms';

export const metadata = { title: 'Esqueci minha senha' };

export default function EsqueciSenhaDono() {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-panel w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-bold text-primary">Esqueci minha senha</h1>
        <p className="mb-6 text-sm text-slate-500">Informe o e-mail da sua conta e enviamos um link para criar uma senha nova.</p>
        <ForgotForm kind="restaurant" backHref="/login" />
      </div>
    </main>
  );
}
