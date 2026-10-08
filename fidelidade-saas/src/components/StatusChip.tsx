export const STATUS_LOOK: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Ativa', cls: 'bg-emerald-100 text-emerald-700' },
  PENDING: { label: 'Aguardando pagamento', cls: 'bg-amber-100 text-amber-800' },
  PAST_DUE: { label: 'Inadimplente', cls: 'bg-rose-100 text-rose-700' },
  CANCELED: { label: 'Cancelada', cls: 'bg-slate-200 text-slate-600' },
};

export function StatusChip({ status }: { status: string }) {
  const s = STATUS_LOOK[status] ?? STATUS_LOOK.CANCELED;
  return <span className={`inline-block whitespace-nowrap rounded-md px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}
