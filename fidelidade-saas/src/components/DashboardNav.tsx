'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icons';

const items: { href: string; label: string; icon: IconName; desktopOnly?: boolean }[] = [
  { href: '/dashboard', label: 'Início', icon: 'home' },
  { href: '/dashboard/caixa', label: 'Caixa', icon: 'receipt' },
  { href: '/dashboard/agenda', label: 'Agenda', icon: 'clock' },
  { href: '/dashboard/pedidos', label: 'Pedidos', icon: 'bag' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: 'users' },
  { href: '/dashboard/resgates', label: 'Resgates', icon: 'gift' },
  { href: '/dashboard/mensagens', label: 'Mensagens', icon: 'chat', desktopOnly: true }, // no celular o atalho fica no Início
  { href: '/dashboard/avaliacoes', label: 'Avaliações', icon: 'star', desktopOnly: true }, // no celular o atalho fica no Início (a barra de baixo já está cheia)
  { href: '/dashboard/configuracoes', label: 'Regras', icon: 'cog' },
];

export function DashboardNav({ variant, agenda = false, pending: pendingBookings = 0, orders = false, newOrders = 0, caixa = 0, chats = 0 }: { variant: 'top' | 'bottom'; agenda?: boolean; pending?: number; orders?: boolean; newOrders?: number; caixa?: number; chats?: number }) {
  const pathname = usePathname();
  // Destaca a aba no mesmo instante do toque (antes da página nova chegar), para a interface responder na hora.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const current = pending ?? pathname;
  const visible = items.filter((i) => (agenda || i.href !== '/dashboard/agenda') && (orders || i.href !== '/dashboard/pedidos')); // Agenda e Pedidos só aparecem para quem usa
  const count = (href: string) => (href === '/dashboard/agenda' ? pendingBookings : href === '/dashboard/pedidos' ? newOrders : href === '/dashboard/caixa' ? caixa : href === '/dashboard/mensagens' ? chats : 0);
  const badge = (href: string) => count(href) > 0 && <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={`${count(href)} aguardando`}>{count(href)}</span>;
  const bottomItems = visible.filter((i) => !i.desktopOnly);
  const active = (href: string) => (href === '/dashboard' ? current === href : current.startsWith(href));

  if (variant === 'top') {
    return (
      <nav className="hidden gap-1 md:flex">
        {visible.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setPending(i.href)}
            className={`nav-tab inline-flex items-center gap-1.5 ${active(i.href) ? 'nav-tab-active' : ''}`}
          >
            <Icon name={i.icon} size={15} />
            {i.label}
            {badge(i.href)}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className={`glass-panel grid ${bottomItems.length > 6 ? 'grid-cols-7' : bottomItems.length > 5 ? 'grid-cols-6' : 'grid-cols-5'} gap-1 p-1.5`}>
      {bottomItems.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={() => setPending(i.href)}
          className={`nav-tab flex flex-col items-center gap-0.5 !rounded-2xl !px-1 !py-2 !text-[11px] ${active(i.href) ? 'nav-tab-active nav-tab-lime' : ''}`}
        >
          <span className="relative">
            <Icon name={i.icon} size={20} />
            {count(i.href) > 0 && <span className="absolute -right-2 -top-1.5 rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">{count(i.href)}</span>}
          </span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
