import { decideInteractionAction } from '@/app/actions/restaurant';
import { agoText, releaseText } from '@/lib/interaction-approval';
import { shortName } from '@/lib/br';
import { Icon } from './Icons';

export type PendingInteraction = { id: string; label: string; points: number; createdAt: Date; autoAt: Date | null; customerName: string };

/** Pedidos "Já fiz" esperando o dono: aprovar credita os pontos, recusar avisa o cliente. Os automáticos entram sozinhos no prazo. */
export function InteractionRequests({ items }: { items: PendingInteraction[] }) {
  if (items.length === 0) return null;
  const now = new Date();
  return (
    <section aria-labelledby="pedidos-pontos" className="glass-panel !rounded-[22px] p-4" data-testid="interaction-requests">
      <h2 id="pedidos-pontos" className="mb-1 flex items-center gap-2 text-sm font-bold text-primary">
        <Icon name="bell" size={16} className="text-electric-600" /> Pedidos de pontos <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white">{items.length}</span>
      </h2>
      <p className="mb-3 text-xs text-slate-500">O cliente diz que fez (avaliou, postou…). Confira e aprove; os automáticos entram sozinhos no prazo, se você não recusar.</p>
      <ul className="divide-y divide-slate-100">
        {items.map((i) => (
          <li key={i.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">{shortName(i.customerName)}</p>
                <p className="truncate text-sm text-slate-600">{i.label}</p>
                <p className="text-xs text-slate-400">{agoText(i.createdAt, now)}{i.autoAt ? ` · ${releaseText(i.autoAt, now)}` : ''}</p>
              </div>
              <span className="chip-lima shrink-0">+{i.points.toLocaleString('pt-BR')} pts</span>
            </div>
            <div className="flex gap-2">
              {(['approve', 'reject'] as const).map((op) => (
                <form key={op} action={decideInteractionAction} autoComplete="off">
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="op" value={op} />
                  <button className={`${op === 'approve' ? 'glass-button-navy' : 'btn-danger'} btn-sm`} aria-label={`${op === 'approve' ? 'Aprovar' : 'Recusar'}: ${i.label} de ${shortName(i.customerName)}`}>{op === 'approve' ? 'Aprovar' : 'Recusar'}</button>
                </form>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
