import Link from 'next/link';
import { IsoIllustration } from './Illustrations';

/** Tela vazia com ilustração isométrica, título, explicação e, se fizer sentido, um próximo passo. */
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
    <div className={`flex flex-col items-center text-center ${compact ? 'py-2' : 'glass-panel bg-dots p-6 sm:p-8'}`}>
      <IsoIllustration variant={variant} size={compact ? 150 : 190} />
      <p className="mt-1 text-lg font-semibold text-primary">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{text}</p>
      {action && (
        <Link href={action.href} className="glass-button btn-sm mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}
