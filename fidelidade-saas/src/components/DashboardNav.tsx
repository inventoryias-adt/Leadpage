'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icons';

const items: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Início', icon: 'home' },
  { href: '/dashboard/caixa', label: 'Caixa', icon: 'receipt' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: 'users' },
  { href: '/dashboard/resgates', label: 'Resgates', icon: 'gift' },
  { href: '/dashboard/configuracoes', label: 'Regras', icon: 'cog' },
];

export function DashboardNav({ variant }: { variant: 'top' | 'bottom' }) {
  const pathname = usePathname();
  // Destaca a aba no mesmo instante do toque (antes da página nova chegar), para a interface responder na hora.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const current = pending ?? pathname;
  const active = (href: string) => (href === '/dashboard' ? current === href : current.startsWith(href));

  if (variant === 'top') {
    return (
      <nav className="hidden gap-1 md:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setPending(i.href)}
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
          onClick={() => setPending(i.href)}
          className={`nav-tab flex flex-col items-center gap-0.5 !rounded-2xl !px-1 !py-2 !text-[11px] ${active(i.href) ? 'nav-tab-active' : ''}`}
        >
          <Icon name={i.icon} size={20} />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
