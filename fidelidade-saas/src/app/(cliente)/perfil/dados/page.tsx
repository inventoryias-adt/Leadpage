import Link from 'next/link';
import { BirthdayCard } from '@/components/BirthdayCard';
import { ContactForm, CpfForm, NameForm, PasswordForm } from '@/components/CustomerDataForms';
import { Icon } from '@/components/Icons';
import { InstagramCard } from '@/components/InstagramCard';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { maskCpf } from '@/lib/br';
import { prisma } from '@/lib/db';
import { profilePhotoUrl } from '@/lib/images';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Meus dados' };
export const dynamic = 'force-dynamic';

/** Tudo o que o cliente pode mudar sobre si, num lugar só: foto, nome, telefone, e-mail, CPF, senha, aniversário e Instagram. */
export default async function MeusDadosPage() {
  const customer = await requireCustomer('/perfil/dados');
  const photo = await prisma.customerPhoto.findUnique({ where: { customerId: customer.id }, select: { updatedAt: true } });
  const needsPassword = !!customer.passwordHash;
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6 md:pt-8">
      <header>
        <Link href="/perfil" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600" data-testid="back-perfil"><Icon name="back" size={16} /> Perfil</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Meus dados</h1>
        <p className="text-sm text-slate-600">Mude o que precisar: foto, nome, telefone, e-mail, CPF e senha.</p>
        <ProfilePhoto name={customer.name} photoUrl={profilePhotoUrl(photo?.updatedAt)}>
          <p className="truncate text-lg font-extrabold text-primary">{customer.name}</p>
          <p className="text-xs text-slate-500">CPF {maskCpf(customer.cpf)}</p>
        </ProfilePhoto>
      </header>
      <NameForm name={customer.name} />
      <ContactForm phone={customer.phone} email={customer.email} needsPassword={needsPassword} />
      <CpfForm cpfMasked={maskCpf(customer.cpf)} needsPassword={needsPassword} />
      {needsPassword && <PasswordForm />}
      <BirthdayCard initial={customer.birthDay != null && customer.birthMonth != null ? { day: customer.birthDay, month: customer.birthMonth } : null} />
      <InstagramCard handle={customer.instagram} />
    </main>
  );
}
