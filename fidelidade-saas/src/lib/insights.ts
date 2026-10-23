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
    out.push({ id: 'campanha', title: 'Crie a primeira campanha', text: day ? `Seu movimento é maior na ${day}. Teste pontos em dobro no dia mais fraco para equilibrar a semana.` : 'Pontos em dobro num dia fraco ou bônus para quem volta costumam trazer clientes de volta.', href: '/dashboard/configuracoes?etapa=regras&abrir=campanhas#campanhas', cta: 'Criar campanha' });
  }
  if (c.rewardsCount === 0) out.push({ id: 'premio', title: 'Cadastre prêmios', text: 'Sem prêmio o cliente não tem motivo para juntar pontos.', href: '/dashboard/configuracoes?etapa=premios#produtos', cta: 'Cadastrar prêmio' });
  else if (c.rewardsWithoutPhoto > 0) out.push({ id: 'foto', title: `${c.rewardsWithoutPhoto} ${c.rewardsWithoutPhoto === 1 ? 'prêmio está' : 'prêmios estão'} sem foto`, text: 'Prêmio com foto é resgatado bem mais. Leva um minuto.', href: '/dashboard/configuracoes?etapa=premios#produtos', cta: 'Adicionar fotos' });
  if (c.unitsWithoutLocation > 0 && c.checkInPoints > 0) out.push({ id: 'local', title: 'Ative o check-in por localização', text: 'Defina a localização da unidade para o cliente ganhar pontos ao chegar e aparecer em “Lugares perto de você”.', href: '/dashboard/configuracoes?etapa=negocio#unidades', cta: 'Definir localização' });
  if (!c.hasLogo || !c.hasCover) out.push({ id: 'marca', title: 'Complete a identidade da marca', text: 'Logo e foto de capa deixam a sua página mais confiável na vitrine.', href: '/dashboard/configuracoes?etapa=negocio#identidade', cta: 'Enviar imagens' });
  if (c.challengesCount === 0) out.push({ id: 'desafio', title: 'Crie um desafio', text: 'Ex.: 2 compras na semana rendem bônus. É o jeito mais simples de aumentar a frequência.', href: '/dashboard/configuracoes?etapa=regras&abrir=desafios#desafios', cta: 'Criar desafio' });
  if (c.referralPoints <= 0) out.push({ id: 'indicacao', title: 'Ative a indicação de amigos', text: 'Quem indica ganha pontos quando o amigo faz a primeira compra: clientes novos sem anúncio.', href: '/dashboard/configuracoes?etapa=regras&abrir=engajamento#engajamento', cta: 'Configurar' });
  if (c.customers > 0 && c.purchasesInPeriod === 0) out.push({ id: 'parado', title: 'Sem compras lançadas neste período', text: 'Lembre o caixa de gerar o QR Code depois de cada pagamento: sem lançamento não há pontos.', href: '/dashboard/caixa', cta: 'Abrir o Caixa' });
  return out.slice(0, 4);
}

/** Detalhe de um dia do gráfico de vendas (tudo em texto/número simples: vai do servidor para o navegador). */
export type DayDetail = {
  ymd: string;
  title: string; // "Quarta, 21/10"
  count: number;
  cents: number;
  points: number;
  ticketCents: number;
  prevWeek: { count: number; cents: number };
  purchases: { time: string; who: string; cents: number; points: number; what: string }[];
  redemptions: { who: string; what: string; status: string }[];
  promos: { title: string; uses: number; points: number }[];
  challenges: { title: string; count: number }[];
  newCustomers: number;
  interactions: number;
  birthdayGifts: number;
};

/** Frases que ligam o movimento do dia ao que aconteceu nele (comparação com a semana anterior, campanhas, resgates…). */
export function dayReasons(d: DayDetail): string[] {
  const out: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const delta = deltaPct(d.count, d.prevWeek.count);
  if (d.count === 0) {
    out.push(d.prevWeek.count > 0 ? `Sem compras lançadas. No mesmo dia da semana anterior foram ${plural(d.prevWeek.count, 'compra', 'compras')}.` : 'Sem compras lançadas neste dia.');
  } else if (d.prevWeek.count === 0) {
    out.push('No mesmo dia da semana anterior não houve compras: este foi um dia novo para o seu movimento.');
  } else if (delta != null && Math.abs(delta) >= 15) {
    out.push(`${Math.abs(delta)}% ${delta > 0 ? 'mais' : 'menos'} compras do que no mesmo dia da semana anterior (${d.prevWeek.count}).`);
  } else {
    out.push('Movimento parecido com o do mesmo dia da semana anterior.');
  }
  for (const p of d.promos.slice(0, 2)) out.push(`A campanha “${p.title}” foi usada em ${plural(p.uses, 'compra', 'compras')} e rendeu ${p.points} pontos extras.`);
  if (d.redemptions.length > 0) out.push(`${plural(d.redemptions.length, 'prêmio resgatado', 'prêmios resgatados')}: ${[...new Set(d.redemptions.map((r) => r.what))].slice(0, 2).join(', ')}.`);
  for (const c of d.challenges.slice(0, 2)) out.push(`${plural(c.count, 'cliente concluiu', 'clientes concluíram')} o desafio “${c.title}”.`);
  if (d.newCustomers > 0) out.push(`${plural(d.newCustomers, 'cliente novo entrou', 'clientes novos entraram')} na carteira.`);
  if (d.interactions > 0) out.push(`${plural(d.interactions, 'ação aprovada', 'ações aprovadas')} (check-in, avaliação, indicação…) deu pontos.`);
  if (d.birthdayGifts > 0) out.push(`${plural(d.birthdayGifts, 'presente de aniversário', 'presentes de aniversário')} em pontos creditado${d.birthdayGifts === 1 ? '' : 's'}.`);
  if (d.count > 0 && d.promos.length === 0 && d.redemptions.length === 0 && d.challenges.length === 0 && d.newCustomers === 0) out.push('Nenhuma campanha, resgate ou desafio aparece neste dia: o movimento veio dos clientes que já compram.');
  return out;
}

/** Detalhe de um horário do mapa de calor (um dia da semana + uma hora, últimos 90 dias). */
export type SlotDetail = {
  dow: number;
  hour: number;
  count: number;
  cents: number;
  ticketCents: number;
  weeks: number; // semanas com pelo menos uma compra nesse horário
  totalWeeks: number;
  recent: { ymd: string; label: string; count: number }[]; // últimas ocorrências, da mais nova para a mais antiga
  topClients: { who: string; count: number }[];
  promos: { title: string; uses: number }[];
};

/** O que o dono pode fazer com este horário: aproveitar o pico ou preencher um horário fraco. */
export function slotTips(s: SlotDetail, bestCount: number): string[] {
  const out: string[] = [];
  if (s.count === 0) {
    out.push('Ninguém comprou neste horário nos últimos 90 dias.');
    out.push('Uma campanha só para este dia e hora (por exemplo, pontos em dobro) pode trazer movimento.');
    return out;
  }
  out.push(`Houve compra em ${s.weeks} de ${s.totalWeeks} semanas neste horário.`);
  if (bestCount > 0 && s.count >= bestCount * 0.8) out.push('É um dos seus horários de pico: confira se a equipe e o estoque dão conta.');
  else if (bestCount > 0 && s.count <= bestCount * 0.3) out.push('Movimento baixo perto do seu pico: uma campanha neste horário pode puxar clientes.');
  if (s.promos.length === 0) out.push('Nenhuma campanha foi usada aqui: dá para testar uma promoção neste horário e comparar.');
  else out.push(`A campanha “${s.promos[0].title}” foi usada ${s.promos[0].uses} ${s.promos[0].uses === 1 ? 'vez' : 'vezes'} neste horário.`);
  return out;
}
