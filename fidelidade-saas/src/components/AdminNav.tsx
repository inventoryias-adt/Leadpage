'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin', label: 'Visão geral' },
  { href: '/admin/assinantes', label: 'Assinantes' },
  { href: '/admin/contatos', label: 'Contatos' },
  { href: '/admin/campanhas', label: 'Campanhas' },
  { href: '/admin/avaliacoes', label: 'Avaliações' },
  { href: '/admin/indicacoes', label: 'Indicações' },
  { href: '/admin/registro', label: 'Registro' },
];

export function AdminNav({ novos = 0, denuncias = 0, postDenuncias = 0 }: { novos?: number; denuncias?: number; postDenuncias?: number }) {
  const pathname = usePathname();
  const active = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));
  return (
    <nav aria-label="Administração" className="flex gap-1">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined} className={`nav-tab ${active(i.href) ? 'nav-tab-active' : ''}`}>
          {i.label}
          {i.href === '/admin/contatos' && novos > 0 && <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={`${novos} novos`}>{novos}</span>}
          {i.href === '/admin/indicacoes' && postDenuncias > 0 && <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={`${postDenuncias} denúncias`}>{postDenuncias}</span>}
          {i.href === '/admin/avaliacoes' && denuncias > 0 && <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={`${denuncias} denúncias`}>{denuncias}</span>}
        </Link>
      ))}
    </nav>
  );
}
