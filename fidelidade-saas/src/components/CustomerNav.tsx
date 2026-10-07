'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Brand } from './Brand';
import { Icon, type IconName } from './Icons';

const tabs: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/carteira', label: 'Início', icon: 'home', match: (p) => p.startsWith('/carteira') },
  { href: '/lugares', label: 'Lugares', icon: 'compass', match: (p) => p.startsWith('/lugares') || p.startsWith('/lugar/') },
  { href: '/perfil', label: 'Perfil', icon: 'user', match: (p) => p.startsWith('/perfil') },
];

/** Barra de abas flutuante do app do cliente. A aba é destacada no toque, antes da tela nova chegar. */
export function CustomerNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const current = pending ?? pathname;

  return (
    <>
    {/* Computador: barra no topo */}
    <header className="sticky top-0 z-30 hidden px-6 pt-4 md:block">
      <div className="glass-panel-sm mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2.5">
        <Brand href="/carteira" />
        <nav aria-label="Navegação principal" className="flex gap-1">
          {tabs.map((t) => {
            const active = t.match(current);
            return (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setPending(t.href)}
                aria-current={active ? 'page' : undefined}
                className={`nav-tab flex items-center gap-2 ${active ? 'nav-tab-active' : ''}`}
              >
                <Icon name={t.icon} size={18} />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>

    {/* Celular: barra flutuante embaixo */}
    <nav aria-label="Navegação principal" className="pointer-events-none md:hidden fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="glass-panel pointer-events-auto grid w-full max-w-sm grid-cols-3 gap-1 !rounded-full p-1.5">
        {tabs.map((t) => {
          const active = t.match(current);
          return (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setPending(t.href)}
              aria-current={active ? 'page' : undefined}
              className={`nav-tab flex flex-col items-center gap-0.5 !rounded-full !px-2 !py-2 !text-[11px] ${active ? 'nav-tab-active' : ''}`}
            >
              <Icon name={t.icon} size={20} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
