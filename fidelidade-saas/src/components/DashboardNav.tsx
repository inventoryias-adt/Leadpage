'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icons';

const items: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Início', icon: 'home' },
  { href: '/dashboard/caixa', label: 'Caixa', icon: 'receipt' },
  { href: '/dashboard/agenda', label: 'Agenda', icon: 'clock' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: 'users' },
  { href: '/dashboard/resgates', label: 'Resgates', icon: 'gift' },
  { href: '/dashboard/configuracoes', label: 'Regras', icon: 'cog' },
];

export function DashboardNav({ variant, agenda = false, pending: pendingBookings = 0 }: { variant: 'top' | 'bottom'; agenda?: boolean; pending?: number }) {
  const pathname = usePathname();
  // Destaca a aba no mesmo instante do toque (antes da página nova chegar), para a interface responder na hora.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const current = pending ?? pathname;
  const visible = items.filter((i) => agenda || i.href !== '/dashboard/agenda'); // a aba só aparece para quem tem serviços cadastrados
  const badge = (href: string) => href === '/dashboard/agenda' && pendingBookings > 0 && <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={`${pendingBookings} aguardando confirmação`}>{pendingBookings}</span>;
  const active = (href: string) => (href === '/dashboard' ? current === href : current.startsWith(href));

  if (variant === 'top') {
    return (
      <nav className="hidden gap-1 md:flex">
        {visible.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setPending(i.href)}
            className={`nav-tab ${active(i.href) ? 'nav-tab-active' : ''}`}
          >
            {i.label}
            {badge(i.href)}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className={`glass-panel grid ${visible.length > 5 ? 'grid-cols-6' : 'grid-cols-5'} gap-1 p-1.5`}>
      {visible.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={() => setPending(i.href)}
          className={`nav-tab flex flex-col items-center gap-0.5 !rounded-2xl !px-1 !py-2 !text-[11px] ${active(i.href) ? 'nav-tab-active' : ''}`}
        >
          <span className="relative">
            <Icon name={i.icon} size={20} />
            {i.href === '/dashboard/agenda' && pendingBookings > 0 && <span className="absolute -right-2 -top-1.5 rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">{pendingBookings}</span>}
          </span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
