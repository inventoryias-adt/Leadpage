/** Dica de gráfico: aparece na hora, em um cartão claro com borda, acima do ponto sob o mouse (ou foco). */
export function ChartTooltip({ leftPct, topPct, children }: { leftPct: number; topPct: number; children: React.ReactNode }) {
  const left = Math.min(88, Math.max(12, leftPct));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 min-w-[8.5rem] whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-left shadow-lg"
      style={{ left: `${left}%`, top: `${topPct}%`, transform: 'translate(-50%, calc(-100% - 10px))' }}
    >
      {children}
    </div>
  );
}
