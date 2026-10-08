import Link from 'next/link';
import { Icon, type IconName } from './Icons';

const ICON: Record<'coin' | 'shield' | 'gift' | 'users' | 'chart', IconName> = {
  coin: 'star',
  shield: 'lock',
  gift: 'gift',
  users: 'users',
  chart: 'chart',
};

/** Tela vazia: ícone discreto, título, explicação e, se fizer sentido, um próximo passo. */
export function EmptyState({
  variant,
  title,
  text,
  action,
  compact,
}: {
  variant: 'coin' | 'shield' | 'gift' | 'users' | 'chart';
  title: string;
  text: string;
  action?: { href: string; label: string };
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-4' : 'glass-panel p-8 sm:p-10'}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F6F7F9] text-slate-500">
        <Icon name={ICON[variant]} size={22} />
      </span>
      <p className="mt-3 text-base font-semibold text-primary">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{text}</p>
      {action && (
        <Link href={action.href} className="glass-button btn-sm mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}
