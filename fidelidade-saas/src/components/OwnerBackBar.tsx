'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icons';

/** Telas do painel que não estão na barra de baixo e não têm botão de voltar próprio: para onde cada uma volta. */
const BACK: Record<string, [string, string]> = {
  '/dashboard/mensagens': ['/dashboard', 'Início'],
  '/dashboard/avaliacoes': ['/dashboard', 'Início'],
  '/dashboard/indicacoes': ['/dashboard', 'Início'],
  '/dashboard/clube': ['/dashboard', 'Início'],
  '/dashboard/financeiro': ['/dashboard', 'Início'],
  '/dashboard/horarios': ['/dashboard', 'Início'],
  '/dashboard/pontos': ['/dashboard', 'Início'],
  '/dashboard/vendas': ['/dashboard', 'Início'],
  '/dashboard/cardapio': ['/dashboard/pedidos', 'Pedidos'],
};

/** "‹ Início" no alto das telas internas do painel, para o gestor saber que dá para voltar. */
export function OwnerBackBar() {
  const to = BACK[usePathname().replace(/\/$/, '')];
  if (!to) return null;
  return (
    <div className="mb-3">
      <Link href={to[0]} className="glass-button-ghost btn-sm shrink-0 !gap-1" data-testid="owner-back" aria-label={`Voltar para ${to[1]}`}>
        <Icon name="back" size={16} /> {to[1]}
      </Link>
    </div>
  );
}
