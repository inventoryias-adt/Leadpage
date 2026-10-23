import Link from 'next/link';
import { Icon, type IconName } from './Icons';

export type Shortcut = {
  href: string;
  icon: IconName;
  label: string;
  /** Frase curta embaixo do título (só na lista). */
  hint?: string;
  /** Número em destaque (cupons para retirar, pedidos em andamento…). */
  count?: number;
  testId?: string;
};

/**
 * Atalhos do Início: uma fileira de quatro botões pequenos (ícone + nome), com o número em destaque no canto quando há algo esperando.
 * Cabe numa linha no celular, sem cartões grandes.
 */
export function ShortcutTiles({ items, label = 'Atalhos' }: { items: Shortcut[]; label?: string }) {
  return (
    <nav aria-label={label} data-testid="shortcut-tiles">
      <ul className="grid grid-cols-4 gap-2">
        {items.map((s) => (
          <li key={s.href}>
            <Link href={s.href} data-testid={s.testId} className="glass-panel-sm card-link relative flex h-full flex-col items-center gap-1.5 !rounded-[18px] px-1 py-3 text-center">
              <span className="icon-tile !h-10 !w-10"><Icon name={s.icon} size={20} /></span>
              <span className="text-[11px] font-bold leading-tight text-slate-700">{s.label}</span>
              {s.count != null && s.count > 0 && (
                <span aria-label={`${s.count} esperando`} className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#0F1F3D] px-1 text-[10px] font-extrabold text-lima">{s.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Atalhos do Perfil: lista agrupada, uma linha por atalho (ícone, título, frase curta, seta), em vez de cartões grandes.
 * Cada grupo tem um título pequeno; as linhas ficam num único painel com divisórias.
 */
export function ShortcutGroups({ groups }: { groups: { title: string; items: Shortcut[] }[] }) {
  return (
    <div className="space-y-4" data-testid="shortcut-groups">
      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`sg-${g.title}`}>
          <h2 id={`sg-${g.title}`} className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{g.title}</h2>
          <ul className="glass-panel divide-y divide-slate-100 !rounded-[20px]">
            {g.items.map((s) => (
              <li key={s.href}>
                <Link href={s.href} data-testid={s.testId} className="card-link flex items-center gap-3 px-4 py-3">
                  <span className="icon-tile !h-10 !w-10 shrink-0"><Icon name={s.icon} size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-slate-800">{s.label}</span>
                    {s.hint && <span className="block truncate text-xs text-slate-500">{s.hint}</span>}
                  </span>
                  {s.count != null && s.count > 0 && <span className="chip-lima shrink-0">{s.count}</span>}
                  <Icon name="chevron" size={18} className="shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
