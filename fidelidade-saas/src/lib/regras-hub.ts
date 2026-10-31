/**
 * Central de Regras (sem banco, para testar): transforma o que o dono já configurou em cartões com resumo e situação,
 * e calcula o quanto falta para o clube estar pronto para o cliente.
 */
import { formatPoints } from './points';
import { summarizeSchedule, type Schedule } from './hours';

export type Etapa = 'negocio' | 'regras' | 'premios' | 'agenda' | 'compartilhar' | 'conta';
export type HubIcon = 'user' | 'pin' | 'star' | 'gift' | 'spark' | 'trophy' | 'target' | 'calendar' | 'bag' | 'users' | 'lock' | 'check' | 'share';
export type HubStatus = 'ok' | 'todo' | 'on' | 'off' | 'opt';

export type Topic = { id: string; etapa: Etapa; blocks: string[]; title: string; hint: string; where: string; icon: HubIcon };

/** Cada assunto é uma tela própria: `?etapa=…&topico=…`. `blocks` são os ids dos blocos da etapa que aparecem nela. */
export const TOPICS: Topic[] = [
  { id: 'marca', etapa: 'negocio', blocks: ['dados', 'identidade'], title: 'Marca e identidade', hint: 'Nome, logo, capa, cor, slogan e o texto "sobre nós".', where: 'Início do app, página do seu lugar e vitrine Lugares', icon: 'user' },
  { id: 'unidades', etapa: 'negocio', blocks: ['unidades'], title: 'Unidades e horários', hint: 'Onde fica, quando abre e a localização no mapa de cada unidade.', where: 'Página do seu lugar, mapa e check-in', icon: 'pin' },
  { id: 'pontos', etapa: 'regras', blocks: ['pontos'], title: 'Pontos por compra', hint: 'Quanto cada real vale em pontos e quantos resgates cada CPF pode fazer por mês.', where: 'Cartão da carteira e página do seu lugar', icon: 'star' },
  { id: 'premios', etapa: 'premios', blocks: ['produtos'], title: 'Prêmios', hint: 'O que o cliente troca por pontos. Com foto, o resgate vende mais.', where: 'Página do seu lugar, aba Prêmios, e a tela de resgate', icon: 'gift' },
  { id: 'campanhas', etapa: 'regras', blocks: ['campanhas'], title: 'Campanhas de pontos', hint: 'Pontos em dobro na terça, bônus acima de um valor… Viram card na vitrine dos clientes.', where: 'Vitrine Lugares, página do seu lugar e cartão da carteira', icon: 'spark' },
  { id: 'desafios', etapa: 'regras', blocks: ['desafios'], title: 'Desafios da casa', hint: 'Metas que dão pontos de bônus sozinhas, como "2 compras na semana".', where: 'Página do seu lugar, em Desafios da casa', icon: 'trophy' },
  { id: 'engajamento', etapa: 'regras', blocks: ['engajamento'], title: 'Check-in, indicação e aniversário', hint: 'Jeitos de fazer o cliente voltar e trazer gente nova. Cada um tem a sua chave liga/desliga.', where: 'Página do seu lugar, em Ganhar pontos', icon: 'target' },
  { id: 'aniversariante', etapa: 'regras', blocks: ['aniversariante'], title: 'Presente do aniversariante', hint: 'Um item ou benefício para quem faz aniversário, só no dia dele.', where: 'Início do app, Lugares e cupom do cliente', icon: 'gift' },
  { id: 'interacoes', etapa: 'regras', blocks: ['interacoes'], title: 'Interações que dão pontos', hint: 'Pontuação fixa, marcada pelo caixa (avaliar no Google, story no Instagram…).', where: 'Página do seu lugar, em Ganhar pontos', icon: 'check' },
  { id: 'agenda', etapa: 'agenda', blocks: ['agenda-conteudo'], title: 'Agenda e serviços', hint: 'Serviços, equipe e regras de agendamento para quem atende com hora marcada.', where: 'Botão Agendar na página do seu lugar e Meus agendamentos', icon: 'calendar' },
  { id: 'pedidos', etapa: 'premios', blocks: ['pedidos'], title: 'Pedidos pelo app', hint: 'Cardápio em reais: o cliente monta a sacola e retira no balcão.', where: 'Página do seu lugar, botão Fazer pedido', icon: 'bag' },
  { id: 'compartilhar', etapa: 'compartilhar', blocks: ['compartilhar'], title: 'Pontos compartilhados', hint: 'Uma rede entre lugares: o cliente junta pontos em um e usa em outro que participa.', where: 'Carteira do cliente e tela de resgate', icon: 'share' },
  { id: 'conta', etapa: 'conta', blocks: ['conta'], title: 'Minha conta', hint: 'Senha de acesso ao painel e gerenciamento da assinatura.', where: 'Só você vê: não aparece para o cliente', icon: 'lock' },
];

export const topicById = (id: string | undefined) => TOPICS.find((t) => t.id === id);
export const topicHref = (id: string) => `/dashboard/configuracoes?etapa=${topicById(id)?.etapa ?? 'negocio'}&topico=${id}`;

export type HubInput = {
  category: string | null;
  hasLogo: boolean;
  brandColor: string | null;
  tagline: string | null;
  listed: boolean;
  units: { active: boolean; address: string | null; located: boolean; schedule: Schedule | null }[];
  pointsPerReal: number;
  maxRedeemsPerMonth: number;
  rewards: number;
  rewardsWithoutPhoto: number;
  promotions: { live: number; total: number };
  challenges: { active: number; total: number };
  checkInPoints: number;
  referralPoints: number;
  birthdayPoints: number;
  birthdayPerkOn: boolean;
  interactions: number;
  services: number;
  resources: number;
  bookingSuggested: boolean;
  ordersEnabled: boolean;
  shareOut: boolean;
  shareIn: boolean;
};

export type HubItem = { id: string; title: string; icon: HubIcon; status: HubStatus; summary: string; href: string; essential: boolean };
export type HubGroup = { id: string; title: string; hint: string; items: HubItem[] };
export type Hub = { groups: HubGroup[]; essentials: { done: number; total: number }; next: HubItem | null; ideas: string[] };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Seg a Dom: 11h às 23h" ou, quando varia, "Seg a Sex: 9h às 18h e mais 1 faixa". */
export function hoursSummary(schedule: Schedule | null): string {
  if (!schedule) return '';
  const g = summarizeSchedule(schedule).filter((x) => x.hours !== 'Fechado');
  if (!g.length) return 'sempre fechado';
  const first = `${g[0].label}: ${g[0].hours}`;
  return g.length === 1 ? first : `${first} e mais ${plural(g.length - 1, 'faixa', 'faixas')}`;
}

export function buildHub(i: HubInput): Hub {
  const activeUnits = i.units.filter((u) => u.active);
  const firstUnit = activeUnits[0];
  const unitsReady = activeUnits.length > 0 && activeUnits.every((u) => !!u.address && u.located && !!u.schedule);
  const brandReady = i.hasLogo && !!i.category;
  const item = (id: string, status: HubStatus, summary: string, essential = false): HubItem => {
    const t = topicById(id)!;
    return { id, title: t.title, icon: t.icon, status, summary, href: topicHref(id), essential };
  };

  const marca = brandReady
    ? item('marca', 'ok', [i.tagline || 'Logo e categoria definidos', i.brandColor ? 'cor da marca escolhida' : ''].filter(Boolean).join(' · '), true)
    : item('marca', 'todo', [!i.hasLogo ? 'falta a logo' : '', !i.category ? 'falta a categoria' : ''].filter(Boolean).join(' e '), true);

  const unidades = unitsReady
    ? item('unidades', 'ok', `${plural(activeUnits.length, 'unidade ativa', 'unidades ativas')}${firstUnit?.schedule ? ` · ${hoursSummary(firstUnit.schedule)}` : ''}`, true)
    : item('unidades', 'todo', activeUnits.length === 0 ? 'nenhuma unidade ativa' : [activeUnits.some((u) => !u.address) ? 'falta o endereço' : '', activeUnits.some((u) => !u.located) ? 'falta a localização no mapa' : '', activeUnits.some((u) => !u.schedule) ? 'faltam os horários' : ''].filter(Boolean).join(' · '), true);

  const pontos = item('pontos', i.pointsPerReal > 0 ? 'ok' : 'todo', i.pointsPerReal > 0 ? `R$ 1 = ${formatPoints(i.pointsPerReal)} ${i.pointsPerReal === 1 ? 'ponto' : 'pontos'} · até ${plural(i.maxRedeemsPerMonth, 'resgate', 'resgates')} por CPF no mês` : 'defina quanto vale cada real', true);

  const premios = i.rewards > 0
    ? item('premios', 'ok', `${plural(i.rewards, 'prêmio', 'prêmios')}${i.rewardsWithoutPhoto > 0 ? ` · ${plural(i.rewardsWithoutPhoto, 'sem foto', 'sem foto')}` : ' · todos com foto'}`, true)
    : item('premios', 'todo', 'cadastre o primeiro prêmio para o cliente ter por que juntar pontos', true);

  const campanhas = i.promotions.total > 0
    ? item('campanhas', i.promotions.live > 0 ? 'on' : 'opt', `${plural(i.promotions.total, 'campanha', 'campanhas')}${i.promotions.live > 0 ? ` · ${i.promotions.live} valendo agora` : ' · nenhuma valendo agora'}`)
    : item('campanhas', 'opt', 'ex.: pontos em dobro no dia de menos movimento');

  const desafios = i.challenges.total > 0
    ? item('desafios', i.challenges.active > 0 ? 'on' : 'off', i.challenges.active > 0 ? `${plural(i.challenges.active, 'desafio ativo', 'desafios ativos')}` : 'todos pausados')
    : item('desafios', 'opt', 'ex.: 2 compras na semana rendem bônus');

  const eng = [i.checkInPoints > 0 ? `check-in ${formatPoints(i.checkInPoints)} pts` : '', i.referralPoints > 0 ? `indicação ${formatPoints(i.referralPoints)} pts` : '', i.birthdayPoints > 0 ? `aniversário ${formatPoints(i.birthdayPoints)} pts` : ''].filter(Boolean);
  const engajamento = eng.length ? item('engajamento', 'on', eng.join(' · ')) : item('engajamento', 'off', 'tudo desligado: ligue o que fizer sentido');

  const aniversariante = i.birthdayPerkOn ? item('aniversariante', 'on', 'presente ligado') : item('aniversariante', 'off', 'desligado');
  const interacoes = i.interactions > 0 ? item('interacoes', 'on', plural(i.interactions, 'interação cadastrada', 'interações cadastradas')) : item('interacoes', 'opt', 'ex.: avaliar no Google, postar no Instagram');

  const agenda = i.services > 0
    ? item('agenda', 'on', `${plural(i.services, 'serviço', 'serviços')} · ${plural(i.resources, 'profissional ou vaga', 'profissionais ou vagas')}`)
    : item('agenda', i.bookingSuggested ? 'todo' : 'opt', i.bookingSuggested ? 'seu tipo de negócio costuma atender com hora marcada' : 'só se você atende com hora marcada ou reserva');
  const pedidos = item('pedidos', i.ordersEnabled ? 'on' : 'off', i.ordersEnabled ? 'ligado: o cliente já pode pedir pelo app' : 'desligado');
  const compartilhar = item('compartilhar', i.shareOut || i.shareIn ? 'on' : 'off', [i.shareOut ? 'seus pontos valem em outros lugares' : '', i.shareIn ? 'aceita pontos de outros lugares' : ''].filter(Boolean).join(' · ') || 'desligado');
  const conta = item('conta', 'ok', 'senha e assinatura');

  const groups: HubGroup[] = [
    { id: 'comecar', title: 'Para o clube funcionar', hint: 'O essencial: sem isso o cliente não consegue ganhar nem trocar pontos.', items: [marca, unidades, pontos, premios] },
    { id: 'voltar', title: 'Para o cliente voltar', hint: 'Campanhas, desafios e jeitos de trazer gente de volta e gente nova.', items: [campanhas, desafios, engajamento, aniversariante, interacoes] },
    { id: 'atender', title: 'Para atender e vender', hint: 'Agenda com hora marcada e pedidos pelo app.', items: [agenda, pedidos] },
    { id: 'rede', title: 'Rede e conta', hint: 'Pontos entre lugares e o acesso ao painel.', items: [compartilhar, conta] },
  ];
  const essentialItems = groups[0].items;
  const done = essentialItems.filter((x) => x.status === 'ok').length;
  const next = essentialItems.find((x) => x.status !== 'ok') ?? null;

  const ideas: string[] = [];
  if (i.promotions.total === 0) ideas.push('Crie uma campanha para o dia de menos movimento.');
  if (i.challenges.total === 0) ideas.push('Crie um desafio: 2 compras na semana rendem bônus.');
  if (i.referralPoints <= 0) ideas.push('Ligue a indicação de amigos: quem indica ganha na primeira compra do amigo.');
  if (i.rewardsWithoutPhoto > 0) ideas.push('Coloque foto nos prêmios: o resgate vende mais.');
  if (!i.listed) ideas.push('Seu lugar está fora da vitrine Lugares: ligue "Aparecer em Lugares" para novos clientes encontrarem você.');
  return { groups, essentials: { done, total: essentialItems.length }, next, ideas: ideas.slice(0, 3) };
}
