import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icons';

/** Maquetes ilustrativas das telas do app para as páginas públicas (dados fictícios, nada vem do banco). */

function Frame({ children, label, badge }: { children: ReactNode; label: string; badge?: string }) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {badge && (
        <span className="absolute -right-2 -top-3 z-10 rounded-full bg-verde px-4 py-1.5 text-sm font-bold text-primary shadow-md">{badge}</span>
      )}
      <div className="overflow-hidden rounded-[2rem] border border-[#E5E7EB] bg-white p-5 shadow-[0_30px_60px_-30px_rgba(18,40,107,0.35)]">{children}</div>
      <p className="mt-3 text-center text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function Bar({ pct, color = 'bar-grad' }: { pct: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]" role="presentation">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Carteira do cliente: saldo, quanto falta para o prêmio e as últimas compras. */
export function WalletMock() {
  const rows = [
    { when: 'Hoje', value: 'R$ 45,00', pts: '+450 pts' },
    { when: 'Ontem', value: 'R$ 89,00', pts: '+890 pts' },
    { when: '3 dias atrás', value: 'R$ 120,00', pts: '+1.200 pts' },
  ];
  return (
    <Frame label="Exemplo ilustrativo, com dados fictícios" badge="+450 pts hoje">
      <p className="micro text-center">Seus pontos</p>
      <p className="text-center text-5xl font-extrabold tracking-tight text-primary">1.250</p>
      <div className="mt-4 rounded-2xl bg-[#F1F5FF] p-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-600">Sobremesa grátis</span>
          <span className="text-electric-600">faltam 750 pts</span>
        </div>
        <Bar pct={62} />
      </div>
      <p className="micro mb-1 mt-5">Últimas compras</p>
      <ul className="divide-y divide-[#E5E7EB]">
        {rows.map((r) => (
          <li key={r.when} className="flex items-center justify-between py-3">
            <span>
              <span className="block text-sm font-semibold text-primary">{r.when}</span>
              <span className="block text-xs text-slate-500">{r.value}</span>
            </span>
            <span className="text-sm font-bold text-electric-600">{r.pts}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function ChallengeRow({ icon, title, tag, now, total }: { icon: IconName; title: string; tag: string; now: number; total: number }) {
  return (
    <li className="rounded-2xl border border-[#E5E7EB] p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600"><Icon name={icon} size={20} /></span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-primary">{title}</p>
        <span className="shrink-0 rounded-full bg-verde/40 px-2.5 py-1 text-xs font-bold text-primary">{tag}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1"><Bar pct={(now / total) * 100} /></div>
        <span className="text-xs font-semibold text-slate-500">{now}/{total}</span>
      </div>
    </li>
  );
}

/** Desafios e campanhas como o cliente vê no app. */
export function ChallengesMock() {
  return (
    <Frame label="Exemplo ilustrativo, com dados fictícios">
      <p className="micro mb-3">Desafios do lugar</p>
      <ul className="space-y-3">
        <ChallengeRow icon="receipt" title="Compre 3x esta semana" tag="+500 pts" now={2} total={3} />
        <ChallengeRow icon="pin" title="Visite 4x este mês (check-in)" tag="+300 pts" now={1} total={4} />
        <li className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-verde"><Icon name="spark" size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Terça em dobro</span>
            <span className="block text-xs text-slate-300">Compras de terça valem 2x em pontos</span>
          </span>
          <span className="rounded-full bg-verde px-2.5 py-1 text-xs font-bold text-primary">2x</span>
        </li>
      </ul>
    </Frame>
  );
}

/** O "Já fiz" do cliente e o pedido que chega ao dono. */
export function InstagramMock() {
  return (
    <div className="space-y-5">
      <Frame label="1. O cliente posta, marca o lugar e toca em “Já fiz”">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600"><Icon name="camera" size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-primary">Story marcando o lugar</span>
            <span className="block text-xs text-slate-500">Ganhe pontos extras por divulgar</span>
          </span>
          <span className="rounded-full bg-verde/40 px-2.5 py-1 text-xs font-bold text-primary">+50 pts</span>
        </div>
        <button type="button" tabIndex={-1} aria-hidden className="mt-4 w-full rounded-full bg-electric-500 py-3 text-sm font-semibold text-white">Já fiz</button>
      </Frame>
      <Frame label="2. O dono confere no Instagram e libera os pontos">
        <p className="micro mb-3">Pedidos de pontos</p>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F1F3F6] text-sm font-bold text-primary">M</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-primary">Maria S.</span>
            <span className="block text-xs text-slate-500">Story marcando o lugar · +50 pts</span>
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <span aria-hidden className="flex-1 rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-white">Aprovar</span>
          <span aria-hidden className="flex-1 rounded-full border border-[#D5DAE3] py-2.5 text-center text-sm font-semibold text-slate-700">Recusar</span>
        </div>
      </Frame>
    </div>
  );
}
