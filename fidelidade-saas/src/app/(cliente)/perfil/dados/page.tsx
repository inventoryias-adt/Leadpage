import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icons';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { maskCpf } from '@/lib/br';
import { prisma } from '@/lib/db';
import { profilePhotoUrl } from '@/lib/images';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Sua conta' };
export const dynamic = 'force-dynamic';

/** "Sua conta.": lista curta; cada linha abre uma tela com um campo só (nome, contato, CPF, senha, aniversário, Instagram). */
export default async function MeusDadosPage() {
  const customer = await requireCustomer('/perfil/dados');
  const photo = await prisma.customerPhoto.findUnique({ where: { customerId: customer.id }, select: { updatedAt: true } });
  const rows: { campo: string; icon: IconName; label: string; sub: string }[] = [
    { campo: 'nome', icon: 'user', label: 'Nome', sub: customer.name },
    { campo: 'contato', icon: 'phone', label: 'Telefone e e-mail', sub: customer.email ?? 'Acesso ao app e recuperação da conta' },
    { campo: 'cpf', icon: 'receipt', label: 'CPF', sub: maskCpf(customer.cpf) },
    ...(customer.passwordHash ? [{ campo: 'senha', icon: 'lock' as IconName, label: 'Senha', sub: 'Trocar a senha de acesso' }] : []),
    { campo: 'aniversario', icon: 'gift', label: 'Aniversário', sub: customer.birthDay != null && customer.birthMonth != null ? `${String(customer.birthDay).padStart(2, '0')}/${String(customer.birthMonth).padStart(2, '0')}` : 'Para a gente lembrar do seu dia' },
    { campo: 'instagram', icon: 'camera', label: 'Instagram', sub: customer.instagram ? `@${customer.instagram}` : 'Opcional' },
  ];
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 md:pt-8">
      <header className="space-y-3">
        <Link href="/perfil" className="back-link" data-testid="back-perfil"><Icon name="back" size={14} /> Perfil</Link>
        <h1 className="text-primary">Sua conta.</h1>
        <p className="sub">Foto, nome, contato e senha.</p>
        <ProfilePhoto name={customer.name} photoUrl={profilePhotoUrl(photo?.updatedAt)}>
          <p className="truncate text-lg font-extrabold text-primary">{customer.name}</p>
          <p className="text-xs text-slate-500">CPF {maskCpf(customer.cpf)}</p>
        </ProfilePhoto>
      </header>
      <ul className="divide-y divide-[#e6e8ec]" data-testid="conta-lista">
        {rows.map((r) => (
          <li key={r.campo}>
            <Link href={`/perfil/dados/${r.campo}`} className="flex min-h-[4.25rem] items-center gap-4 py-3" data-testid={`conta-${r.campo}`}>
              <Icon name={r.icon} size={22} className="shrink-0 text-slate-700" />
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold text-primary">{r.label}</span>
                <span className="block truncate text-sm italic text-slate-500">{r.sub}</span>
              </span>
              <Icon name="chevron" size={18} className="shrink-0 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
