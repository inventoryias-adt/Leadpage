'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin', label: 'Visão geral' },
  { href: '/admin/assinantes', label: 'Assinantes' },
  { href: '/admin/registro', label: 'Registro' },
];

export function AdminNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));
  return (
    <nav aria-label="Administração" className="flex gap-1">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined} className={`nav-tab ${active(i.href) ? 'nav-tab-active' : ''}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
