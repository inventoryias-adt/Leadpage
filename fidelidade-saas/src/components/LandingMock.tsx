/** Mock ilustrativo do painel e da carteira do cliente, usado na página inicial (dados de exemplo, não reais). */

function Area() {
  // Gráfico de área com degradê azul, no estilo do painel.
  const pts = [8, 10, 6, 14, 12, 22, 30, 28, 36, 48, 44, 58, 52, 66, 70, 62, 60, 56];
  const w = 360;
  const h = 120;
  const step = w / (pts.length - 1);
  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${(h - v * 1.5).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="lm-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2150C9" stopOpacity=".45" />
          <stop offset="1" stopColor="#2150C9" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="#E5E7EB" strokeWidth="1" />
      ))}
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#lm-fill)" />
      <path d={line} fill="none" stroke="#2150C9" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({ label, value, delta, up }: { label: string; value: string; delta: string; up?: boolean }) {
  return (
    <div className="min-w-0 flex-1 border-l border-[#E5E7EB] px-4 first:border-l-0">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-slate-700">{label}</p>
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${up ? 'bg-blue-100 text-electric-600' : 'bg-rose-100 text-rose-600'}`}>{delta}</span>
      </div>
      <p className="mt-1 text-xl font-extrabold text-primary">{value}</p>
    </div>
  );
}

export function LandingMock() {
  return (
    <div className="relative mx-auto max-w-5xl">
      <p className="mb-3 text-center text-xs font-semibold text-slate-500">Exemplo ilustrativo, com dados fictícios</p>
      {/* Painel do estabelecimento */}
      <div className="ml-auto w-full overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-[0_30px_60px_-30px_rgba(18,40,107,0.35)] md:w-[86%]">
        <div className="grid grid-cols-1 md:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="hidden border-r border-[#E5E7EB] bg-[#F6F7F9] p-4 md:block">
            <div className="mb-4 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-slate-400">Pesquisar</div>
            {['Início', 'Caixa', 'Clientes', 'Resgates', 'Regras'].map((t, i) => (
              <p key={t} className={`mb-1 rounded-lg px-3 py-2 text-xs font-semibold ${i === 0 ? 'bg-electric-500 text-white' : 'text-slate-600'}`}>{t}</p>
            ))}
          </div>
          <div className="min-w-0 p-5">
            <p className="mb-3 text-xs font-semibold text-slate-500">Início</p>
            <div className="rounded-2xl border border-[#E5E7EB] p-4">
              <p className="text-xs text-slate-500">Pontos emitidos</p>
              <p className="text-2xl font-extrabold text-primary">12.480</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                {['Hoje', 'Ontem', 'Essa semana', 'Esse mês'].map((t, i) => (
                  <span key={t} className={`rounded-md px-2.5 py-1 ${i === 0 ? 'bg-primary text-white' : 'bg-[#F1F3F6] text-slate-600'}`}>{t}</span>
                ))}
              </div>
              <div className="mt-3 h-28">
                <Area />
              </div>
            </div>
            <div className="mt-3 flex rounded-2xl border border-[#E5E7EB] py-3">
              <Stat label="Pontuações" value="652" delta="+12" up />
              <Stat label="Resgates" value="231" delta="-04" />
              <Stat label="Clientes" value="245" delta="+9" up />
            </div>
          </div>
        </div>
      </div>

      {/* Carteira do cliente no celular */}
      <div className="absolute -bottom-6 left-0 hidden w-[15.5rem] rounded-[2rem] border border-[#E5E7EB] bg-white p-4 shadow-[0_30px_60px_-24px_rgba(18,40,107,0.45)] sm:block md:left-2">
        <div className="mx-auto mb-3 h-5 w-20 rounded-full bg-slate-900/90" />
        <p className="text-[11px] font-semibold text-slate-500">Olá, Lucas</p>
        <div className="mt-2 rounded-2xl border border-[#E5E7EB] p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-electric-500 text-sm font-extrabold text-white">B</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-primary">Burger do Zé</p>
              <p className="text-[10px] text-slate-500">10 pts por R$ 1</p>
            </div>
            <p className="text-right text-lg font-extrabold leading-none text-primary">1.051<span className="block text-[9px] font-bold text-electric-600">pontos</span></p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e8ecf8]"><div className="h-full w-[92%] rounded-full bg-electric-500" /></div>
          <p className="mt-1.5 text-[10px] text-slate-500">Faltam 49 pontos para Sobremesa grátis</p>
        </div>
        <div className="mt-3 flex justify-around text-[9px] font-semibold text-slate-500">
          <span className="text-electric-600">Início</span><span>Lugares</span><span>Avisos</span><span>Perfil</span>
        </div>
      </div>

    </div>
  );
}
