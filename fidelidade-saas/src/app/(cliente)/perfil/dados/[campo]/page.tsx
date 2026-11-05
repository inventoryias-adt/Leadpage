import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BirthdayCard } from '@/components/BirthdayCard';
import { ContactForm, CpfForm, NameForm, PasswordForm } from '@/components/CustomerDataForms';
import { Icon } from '@/components/Icons';
import { InstagramCard } from '@/components/InstagramCard';
import { maskCpf } from '@/lib/br';
import { requireCustomer } from '@/lib/session';

export const dynamic = 'force-dynamic';

const TITLES: Record<string, string> = {
  nome: 'Seu nome.',
  contato: 'Telefone e e-mail.',
  cpf: 'Seu CPF.',
  senha: 'Sua senha.',
  aniversario: 'Seu aniversário.',
  instagram: 'Seu Instagram.',
};

/** Uma tela por campo: título grande, explicação em itálico e um formulário só. */
export default async function CampoPage({ params }: { params: Promise<{ campo: string }> }) {
  const { campo } = await params;
  if (!TITLES[campo]) notFound();
  const customer = await requireCustomer(`/perfil/dados/${campo}`);
  const needsPassword = !!customer.passwordHash;
  if (campo === 'senha' && !needsPassword) notFound();
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 md:pt-8">
      <header className="space-y-3">
        <Link href="/perfil/dados" className="back-link" data-testid="back-conta"><Icon name="back" size={14} /> Sua conta</Link>
        <h1 className="text-primary">{TITLES[campo]}</h1>
      </header>
      {campo === 'nome' && <NameForm name={customer.name} />}
      {campo === 'contato' && <ContactForm phone={customer.phone} email={customer.email} needsPassword={needsPassword} />}
      {campo === 'cpf' && <CpfForm cpfMasked={maskCpf(customer.cpf)} needsPassword={needsPassword} />}
      {campo === 'senha' && <PasswordForm />}
      {campo === 'aniversario' && <BirthdayCard initial={customer.birthDay != null && customer.birthMonth != null ? { day: customer.birthDay, month: customer.birthMonth } : null} />}
      {campo === 'instagram' && <InstagramCard handle={customer.instagram} />}
    </main>
  );
}
