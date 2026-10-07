'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', label: 'Início', icon: '🏠' },
  { href: '/dashboard/caixa', label: 'Caixa', icon: '🧾' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: '👥' },
  { href: '/dashboard/resgates', label: 'Resgates', icon: '🎁' },
  { href: '/dashboard/configuracoes', label: 'Regras', icon: '⚙️' },
];

export function DashboardNav({ variant }: { variant: 'top' | 'bottom' }) {
  const pathname = usePathname();
  const active = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href));

  if (variant === 'top') {
    return (
      <nav className="hidden gap-1 md:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`nav-tab ${active(i.href) ? 'nav-tab-active' : ''}`}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="glass-panel grid grid-cols-5 gap-1 p-1.5">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`nav-tab flex flex-col items-center gap-0.5 !rounded-2xl !px-1 !py-2 !text-[11px] ${active(i.href) ? 'nav-tab-active' : ''}`}
        >
          <span className="text-lg" aria-hidden>{i.icon}</span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
