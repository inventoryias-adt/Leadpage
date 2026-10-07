/** Números do painel do estabelecimento: séries por dia, mapa de horários, segmentos de clientes e sugestões. */

const DAY = 24 * 60 * 60 * 1000;
const BRT = 3 * 60 * 60 * 1000;

/** Data, dia da semana (0 = domingo) e hora em Brasília. */
export function brtParts(d: Date) {
  const l = new Date(d.getTime() - BRT);
  return { ymd: l.toISOString().slice(0, 10), dow: l.getUTCDay(), hour: l.getUTCHours() };
}

export type Sale = { at: Date; cents: number; points: number };
export type DayBucket = { ymd: string; label: string; cents: number; points: number; count: number };

/** Uma barra por dia, terminando hoje (Brasília), mesmo nos dias sem venda. */
export function dailySeries(rows: Sale[], days: number, now: Date = new Date()): DayBucket[] {
  const today = brtParts(now).ymd;
  const end = Date.parse(`${today}T00:00:00Z`);
  const out: DayBucket[] = [];
  const index = new Map<string, DayBucket>();
  for (let i = days - 1; i >= 0; i--) {
    const ymd = new Date(end - i * DAY).toISOString().slice(0, 10);
    const b: DayBucket = { ymd, label: `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`, cents: 0, points: 0, count: 0 };
    out.push(b);
    index.set(ymd, b);
  }
  for (const r of rows) {
    const b = index.get(brtParts(r.at).ymd);
    if (!b) continue;
    b.cents += r.cents;
    b.points += r.points;
    b.count += 1;
  }
  return out;
}

/** Compras por dia da semana (linhas 0–6) e hora (colunas 0–23). */
export function heatmap(rows: { at: Date }[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const r of rows) {
    const { dow, hour } = brtParts(r.at);
    grid[dow][hour] += 1;
  }
  return grid;
}

export function peakSlot(grid: number[][]): { dow: number; hour: number; count: number } | null {
  let best: { dow: number; hour: number; count: number } | null = null;
  grid.forEach((row, dow) => row.forEach((count, hour) => count > (best?.count ?? 0) && (best = { dow, hour, count })));
  return best;
}

export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Variação percentual (null quando não há base de comparação). */
export function deltaPct(now: number, before: number): number | null {
  if (before <= 0) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 100);
}

export type Segment = 'novos' | 'fieis' | 'quase' | 'sumidos';

export type CustomerFacts = {
  createdAt: Date; // quando entrou na carteira do estabelecimento
  purchases: number; // compras já creditadas
  lastPurchaseAt: Date | null;
  balance: number;
  minReward: number | null; // custo do prêmio mais barato
};

export function segmentsOf(f: CustomerFacts, now: Date = new Date()): Segment[] {
  const out: Segment[] = [];
  if (now.getTime() - f.createdAt.getTime() <= 30 * DAY) out.push('novos');
  const sinceLast = f.lastPurchaseAt ? now.getTime() - f.lastPurchaseAt.getTime() : null;
  if (f.purchases >= 4 && sinceLast != null && sinceLast <= 45 * DAY) out.push('fieis');
  if (f.minReward && f.balance < f.minReward && f.balance >= Math.ceil(f.minReward * 0.7)) out.push('quase');
  if (f.purchases >= 1 && sinceLast != null && sinceLast >= 30 * DAY) out.push('sumidos');
  return out;
}

export const SEGMENT_LABEL: Record<Segment, string> = {
  novos: 'Novos',
  fieis: 'Fiéis',
  quase: 'Quase lá',
  sumidos: 'Sumidos',
};

export const SEGMENT_HINT: Record<Segment, string> = {
  novos: 'Entraram nos últimos 30 dias.',
  fieis: '4 compras ou mais e voltaram nos últimos 45 dias.',
  quase: 'Já têm 70% dos pontos do prêmio mais barato.',
  sumidos: 'Não compram há 30 dias ou mais.',
};

export type SuggestionCtx = {
  customers: number;
  purchasesInPeriod: number;
  promosCount: number;
  challengesCount: number;
  rewardsCount: number;
  rewardsWithoutPhoto: number;
  unitsWithoutLocation: number;
  referralPoints: number;
  checkInPoints: number;
  hasLogo: boolean;
  hasCover: boolean;
  sumidos: number;
  quase: number;
  peak: { dow: number; hour: number } | null;
};

export type Suggestion = { id: string; title: string; text: string; href: string; cta: string };

/** Ideias práticas, escolhidas pelo que ainda falta ou pelo que os números mostram. Máximo de 4, as mais úteis primeiro. */
export function suggestions(c: SuggestionCtx): Suggestion[] {
  const out: Suggestion[] = [];
  if (c.quase > 0) out.push({ id: 'quase', title: `${c.quase} ${c.quase === 1 ? 'cliente está' : 'clientes estão'} quase lá`, text: 'Mande um aviso pelo WhatsApp: faltam poucos pontos para o prêmio e a visita acontece.', href: '/dashboard/clientes?seg=quase', cta: 'Ver quem é' });
  if (c.sumidos > 0) out.push({ id: 'sumidos', title: `${c.sumidos} ${c.sumidos === 1 ? 'cliente sumiu' : 'clientes sumiram'} há mais de 30 dias`, text: 'Chame de volta com os pontos que eles já têm, ou crie uma campanha só para quem não volta.', href: '/dashboard/clientes?seg=sumidos', cta: 'Chamar de volta' });
  if (c.promosCount === 0) {
    const day = c.peak ? WEEKDAYS[c.peak.dow] : null;
    out.push({ id: 'campanha', title: 'Crie a primeira campanha', text: day ? `Seu movimento é maior na ${day}. Teste pontos em dobro no dia mais fraco para equilibrar a semana.` : 'Pontos em dobro num dia fraco ou bônus para quem volta costumam trazer clientes de volta.', href: '/dashboard/configuracoes#campanhas', cta: 'Criar campanha' });
  }
  if (c.rewardsCount === 0) out.push({ id: 'premio', title: 'Cadastre prêmios', text: 'Sem prêmio o cliente não tem motivo para juntar pontos.', href: '/dashboard/configuracoes#produtos', cta: 'Cadastrar prêmio' });
  else if (c.rewardsWithoutPhoto > 0) out.push({ id: 'foto', title: `${c.rewardsWithoutPhoto} ${c.rewardsWithoutPhoto === 1 ? 'prêmio está' : 'prêmios estão'} sem foto`, text: 'Prêmio com foto é resgatado bem mais. Leva um minuto.', href: '/dashboard/configuracoes#produtos', cta: 'Adicionar fotos' });
  if (c.unitsWithoutLocation > 0 && c.checkInPoints > 0) out.push({ id: 'local', title: 'Ative o check-in por localização', text: 'Defina a localização da unidade para o cliente ganhar pontos ao chegar e aparecer em “Lugares perto de você”.', href: '/dashboard/configuracoes#unidades', cta: 'Definir localização' });
  if (!c.hasLogo || !c.hasCover) out.push({ id: 'marca', title: 'Complete a identidade da marca', text: 'Logo e foto de capa deixam a sua página mais confiável na vitrine.', href: '/dashboard/configuracoes#identidade', cta: 'Enviar imagens' });
  if (c.challengesCount === 0) out.push({ id: 'desafio', title: 'Crie um desafio', text: 'Ex.: 2 compras na semana rendem bônus. É o jeito mais simples de aumentar a frequência.', href: '/dashboard/configuracoes#desafios', cta: 'Criar desafio' });
  if (c.referralPoints <= 0) out.push({ id: 'indicacao', title: 'Ative a indicação de amigos', text: 'Quem indica ganha pontos quando o amigo faz a primeira compra: clientes novos sem anúncio.', href: '/dashboard/configuracoes#engajamento', cta: 'Configurar' });
  if (c.customers > 0 && c.purchasesInPeriod === 0) out.push({ id: 'parado', title: 'Sem compras lançadas neste período', text: 'Lembre o caixa de gerar o QR Code depois de cada pagamento: sem lançamento não há pontos.', href: '/dashboard/caixa', cta: 'Abrir o Caixa' });
  return out.slice(0, 4);
}
