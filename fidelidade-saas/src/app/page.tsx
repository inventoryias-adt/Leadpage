import Link from 'next/link';
import { Brand, Coin } from '@/components/Brand';
import { Icon, type IconName } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SignupCta } from '@/components/SignupCta';
import { LandingMock } from '@/components/LandingMock';
import { SignupForm } from '@/components/AuthForms';
import { FIRST_MONTH_PRICE, PLAN_PRICE } from '@/lib/plan';

/** Como funciona, na ordem em que acontece. */
const steps = [
  { n: '1', icon: 'cog' as IconName, title: 'Você define as regras', text: 'Em poucos minutos: quanto vale cada R$ 1 em pontos (ex.: R$ 1 = 10 pontos) e quais prêmios o cliente pode ganhar (ex.: sobremesa grátis por 500 pontos).' },
  { n: '2', icon: 'receipt' as IconName, title: 'O cliente paga, você lança os pontos', text: 'No caixa, digite o valor da conta. Se o cliente já tem conta, informe o CPF e os pontos caem direto na carteira dele. Se ainda não tem, gere um QR Code (ou mande o link pelo WhatsApp): ele abre no celular e cria a conta em 1 minuto.' },
  { n: '3', icon: 'trophy' as IconName, title: 'O cliente acompanha e volta', text: 'Na carteira ele vê o saldo, quanto falta para o prêmio, campanhas e desafios do seu lugar. Cada aviso de “falta pouco” é um motivo para voltar.' },
  { n: '4', icon: 'gift' as IconName, title: 'Ele troca os pontos por prêmio', text: 'O app gera um código; ele mostra no balcão, você entrega o prêmio e dá baixa. Pontos como desconto no serviço e campanhas como “pontos em dobro na terça” entram aqui também.' },
];

/** Dados de estudos de terceiros. Cada número tem fonte com link; veja a nota abaixo da seção. */
const facts = [
  {
    big: '5 a 25×',
    text: 'Conquistar um cliente novo pode custar de 5 a 25 vezes mais do que manter um que já compra de você (varia por estudo e setor).',
    source: 'Harvard Business Review, Amy Gallo, 2014',
    href: 'https://hbr.org/2014/10/the-value-of-keeping-the-right-customers',
  },
  {
    big: '25% a 95%',
    text: 'Estudo clássico de Frederick Reichheld (Bain & Company): aumentar em 5% a retenção de clientes pode elevar o lucro entre 25% e 95%.',
    source: 'Bain & Company (2000) e Harvard Business Review (2014)',
    href: 'https://www.bain.com/insights/e-loyalty-your-secret-weapon-on-the-web',
  },
  {
    big: '15% a 25%',
    text: 'Programas de fidelidade bem-sucedidos podem aumentar ao ano a receita dos clientes que resgatam pontos, porque eles compram com mais frequência e gastam mais por visita (ticket médio).',
    source: 'McKinsey & Company, “Next in loyalty”',
    href: 'https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/next-in-loyalty-eight-levers-to-turn-customers-into-fans',
  },
  {
    big: '88,3%',
    text: 'dos brasileiros pesquisados já usam programas de fidelidade, e 84,8% preferem comprar de marcas que oferecem programa ou benefícios.',
    source: 'Panorama da Fidelização no Brasil 2025 (ABEMF e Tudo Sobre Incentivos, 2.313 entrevistados)',
    href: 'https://www.panrotas.com.br/mercado/pesquisas-e-estatisticas/2025/10/88-dos-brasileiros-utilizam-programas-de-fidelidade-diz-pesquisa-da-abemf_222537.html',
  },
  {
    big: 'até 5×',
    text: 'O Sebrae lembra que conquistar novos clientes pode custar até cinco vezes mais do que retê-los, e que clientes fiéis ainda indicam o negócio para amigos e familiares.',
    source: 'Sebrae, “Ainda vale a pena fidelizar os clientes?”',
    href: 'https://sebrae.com.br/sites/PortalSebrae/artigos/ainda-vale-a-pena-fidelizar-os-clientes,796ac1e3dc1f4810VgnVCM100000d701210aRCRD',
  },
];

const forCustomer = [
  { icon: 'star' as IconName, title: 'Pontos em toda compra', text: 'Cada real gasto vira pontos na carteira, sem cartãozinho de papel.' },
  { icon: 'gift' as IconName, title: 'Prêmios e descontos', text: 'Troca por produtos, ou usa os pontos como desconto em serviços agendados.' },
  { icon: 'trophy' as IconName, title: 'Desafios e campanhas', text: 'Pontos em dobro, bônus por meta e campanhas do app que dão motivo para voltar.' },
  { icon: 'pin' as IconName, title: 'Lugares perto de você', text: 'Vê onde ganhar pontos por perto, com horário, distância e o que está valendo.' },
];

const forYou = [
  { icon: 'users' as IconName, title: 'Cliente que volta', text: 'Saldo de pontos é um motivo concreto para escolher o seu lugar de novo.' },
  { icon: 'receipt' as IconName, title: 'Lançar em segundos', text: 'Por CPF direto na conta do cliente ou por QR Code, no celular ou no computador.' },
  { icon: 'star' as IconName, title: 'Mais avaliações e divulgação', text: 'Pontos extras por avaliar no Google ou postar e marcar o seu lugar no Instagram.' },
  { icon: 'lock' as IconName, title: 'Controle antifraude', text: 'QR Code de uso único com validade e limite mensal de resgates por CPF.' },
  { icon: 'clock' as IconName, title: 'Agenda e reservas', text: 'Barbearia, clínica ou restaurante: o cliente marca pelo app e recebe lembrete antes do horário.' },
  { icon: 'chart' as IconName, title: 'Você enxerga o resultado', text: 'Quem voltou, quem sumiu, campanhas que funcionaram e relatórios em planilha.' },
];

const included = [
  'Clientes, lançamentos e resgates ilimitados',
  'Lançamento por CPF ou QR Code, no celular e no computador',
  'Carteira digital do cliente, sem baixar app',
  'Campanhas, desafios, check-in e indicação de amigos',
  'Agenda, reservas e equipe com lembrete ao cliente',
  'Várias unidades na mesma conta',
];

const faqs = [
  { q: 'O cliente precisa baixar algum aplicativo?', a: 'Não. Ele abre o link ou o QR Code no navegador do celular e pode adicionar o Fidelize à tela inicial se quiser. Funciona como um app, sem loja de aplicativos.' },
  { q: 'Como eu lanço os pontos no caixa?', a: 'Digite o valor da conta. Se o cliente já tem conta, digite o CPF dele: aparece o nome abreviado e os pontos caem direto na carteira. Se ainda não tem, gere o QR Code (ou o link para o WhatsApp) e ele cria a conta ao abrir.' },
  { q: 'Como o cliente troca os pontos?', a: 'Pelo app, escolhendo o prêmio. Ele recebe um código, mostra no balcão e você entrega o prêmio e dá baixa. Você escolhe os prêmios e quanto custam.' },
  { q: 'Como funciona a cobrança?', a: `O primeiro mês sai por ${FIRST_MONTH_PRICE}. Depois, assinatura mensal de ${PLAN_PRICE}, sem taxa de adesão e sem fidelidade. Você pode cancelar quando quiser.` },
  { q: 'Em quanto tempo começo a usar?', a: 'Assim que o pagamento é confirmado você configura o estabelecimento em poucos minutos e já pode pontuar.' },
  { q: 'Funciona para outros negócios além de restaurante?', a: 'Sim. Cafeterias, padarias, açaí, barbearias, salões, clínicas de estética e qualquer lugar com atendimento ou balcão. Quem atende com hora marcada ainda usa a agenda do app.' },
  { q: 'Tenho mais de uma loja. Posso usar?', a: 'Pode. Cada unidade tem endereço, horário e localização próprios, e os pontos valem em todas.' },
];

/** Atraso (ms) da animação de abertura da página, para o hero entrar escalonado. */
const d = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties;

/** Linha fina entre as seções. */
function Hatch() {
  return <div aria-hidden className="h-px bg-[#E5E7EB]" />;
}

/** Botão principal de chamada para ação. */
function Cta({ children }: { children: React.ReactNode }) {
  return (
    <SignupCta className="glass-button !w-auto">
      {children}
      <Icon name="chevron" size={16} />
    </SignupCta>
  );
}

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl overflow-x-clip border-x border-[#E5E7EB] bg-white">
      <nav className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Brand />
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link href="/entrar" className="nav-tab">Sou cliente</Link>
          <Link href="/login" className="chip-link">Entrar</Link>
        </div>
      </nav>

      <div aria-hidden className="h-px bg-[#E5E7EB]" />

      {/* Hero + cadastro */}
      <section className="grid items-center gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.1fr_1fr] md:py-16">
        <div>
          <span className="glass-chip enter-top mb-6 !px-3 !py-1.5 !text-[13px]" style={d(0)}>
            Clube de pontos para o seu comércio
          </span>
          <h1 className="enter-top mb-5 text-4xl font-semibold leading-[1.05] text-primary md:text-6xl" style={d(120)}>
            Seu cliente volta,
            <span className="block text-electric-500">gasta mais e <span className="mark-lime text-primary">indica amigos.</span></span>
          </h1>
          <p className="enter-top mb-8 max-w-xl text-lg text-slate-600" style={d(240)}>
            Cada compra vira pontos na carteira do cliente, e os pontos viram prêmios que você escolhe. Você lança pelo CPF ou por QR Code, e o cliente acompanha tudo pelo celular, sem baixar app.
          </p>
          <div className="enter-top flex flex-wrap items-center gap-5" style={d(360)}>
            <Cta>Começar agora</Cta>
            <p className="text-sm text-slate-500">
              <span className="text-3xl font-semibold text-primary">{FIRST_MONTH_PRICE}</span> no primeiro mês · <span className="whitespace-nowrap">depois {PLAN_PRICE}/mês</span>
            </p>
          </div>
        </div>

        <div id="assinar" className="glass-panel enter-right p-6 sm:p-8" style={d(300)}>
          <h2 className="mb-1 text-2xl font-semibold text-primary">Crie sua conta</h2>
          <p className="mb-6 text-sm text-slate-500">Leva 1 minuto. Depois você segue para o pagamento seguro.</p>
          <SignupForm />
        </div>
      </section>

      {/* Vitrine do produto */}
      <section className="relative overflow-hidden border-y border-[#E5E7EB] bg-[#F6F7F9] px-5 py-14 sm:px-8">
        <Reveal from="zoom" className="relative">
          <LandingMock />
        </Reveal>
      </section>

      <Hatch />

      {/* Como funciona */}
      <section className="px-5 py-14 sm:px-8">
        <Reveal from="top">
          <span className="glass-chip mb-4">Como funciona</span>
          <h2 className="mb-3 max-w-2xl text-3xl font-semibold text-primary md:text-4xl">Do balcão à carteira do cliente, em 4 passos.</h2>
          <p className="mb-10 max-w-2xl text-slate-600">Você configura uma vez. Depois, é só lançar a conta de cada cliente e deixar os pontos trabalharem.</p>
        </Reveal>
        <ol className="grid gap-5 md:grid-cols-2">
          {steps.map((s, i) => (
            <Reveal as="li" key={s.n} from={i % 2 === 0 ? 'left' : 'right'} delay={Math.floor(i / 2) * 120} className="flex gap-4 rounded-xl border border-[#E5E7EB] bg-white p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-electric-500 text-lg font-bold text-white">{s.n}</span>
              <div>
                <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-primary"><Icon name={s.icon} size={18} className="text-electric-500" /> {s.title}</h3>
                <p className="text-sm text-slate-600">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        <Reveal from="bottom" className="mt-6 rounded-xl border border-electric-500/30 bg-electric-500/5 p-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-electric-600">Exemplo</p>
          <p className="text-sm text-slate-700">
            Você define R$ 1 = 10 pontos e um prêmio de 1.500 pontos. A Maria gasta R$ 80 e ganha 800 pontos. Na próxima visita, mais R$ 80 e o saldo vai a 1.600: ela troca por um prêmio e já sai com um motivo para voltar de novo.
          </p>
        </Reveal>
      </section>

      <Hatch />

      {/* Por que funciona */}
      <section id="por-que-funciona" className="bg-[#F6F7F9] px-5 py-14 sm:px-8">
        <Reveal from="left">
          <span className="glass-chip mb-4">Por que um clube de pontos funciona</span>
          <h2 className="mb-3 max-w-2xl text-3xl font-semibold text-primary md:text-4xl">Manter o cliente custa menos do que conquistar outro.</h2>
          <p className="mb-10 max-w-2xl text-slate-600">O que dizem pesquisas e instituições sobre fidelização, com a fonte de cada número.</p>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f, i) => (
            <Reveal as="figure" key={f.big} from="zoom" delay={(i % 3) * 110} className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-5">
              <p className="mb-2 text-4xl font-semibold tracking-tight text-electric-500">{f.big}</p>
              <blockquote className="flex-1 text-sm text-slate-700">{f.text}</blockquote>
              <figcaption className="mt-3 text-xs text-slate-500">
                Fonte:{' '}
                <a href={f.href} target="_blank" rel="noopener noreferrer" className="link-inline !font-medium">{f.source}</a>
              </figcaption>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-xs text-slate-500">
          São números de estudos de terceiros, de épocas, setores e países diferentes (os de Reichheld, por exemplo, vêm de e-commerce e serviços financeiros). Servem de referência sobre fidelização em geral e não são uma promessa de resultado do Fidelize: cada negócio colhe de acordo com o programa que monta.
        </p>
      </section>

      <Hatch />

      {/* Benefícios */}
      <section className="px-5 py-14 sm:px-8">
        <Reveal from="right">
          <span className="glass-chip mb-4">Para os dois lados do balcão</span>
          <h2 className="mb-10 max-w-2xl text-3xl font-semibold text-primary md:text-4xl">O cliente tem motivos para voltar. Você tem controle e resultado.</h2>
        </Reveal>

        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">O que o seu cliente ganha</h3>
        <div className="mb-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {forCustomer.map((b, i) => (
            <Reveal key={b.title} from="top" delay={i * 90} className="border-l-2 border-electric-500 pl-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600"><Icon name={b.icon} size={22} /></span>
              <h4 className="mb-1 text-base font-semibold text-primary">{b.title}</h4>
              <p className="text-sm text-slate-600">{b.text}</p>
            </Reveal>
          ))}
        </div>

        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">O que você ganha</h3>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {forYou.map((b, i) => (
            <Reveal key={b.title} from="bottom" delay={(i % 3) * 90} className="border-l-2 border-electric-500 pl-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600"><Icon name={b.icon} size={22} /></span>
              <h4 className="mb-1 text-base font-semibold text-primary">{b.title}</h4>
              <p className="text-sm text-slate-600">{b.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Preço */}
      <section className="bg-dots-dark relative overflow-hidden bg-primary px-5 py-16 text-center sm:px-8">
        <Reveal from="flip" className="mb-5 flex justify-center"><Coin size={72} color="#C6F432" /></Reveal>
        <Reveal from="zoom">
          <h2 className="mx-auto mb-3 max-w-2xl text-3xl font-semibold text-white md:text-4xl">
            Um plano, tudo incluso.
          </h2>
          <p className="mb-2 text-lima"><span className="text-5xl font-extrabold md:text-6xl">{FIRST_MONTH_PRICE}</span> <span className="text-base font-semibold text-slate-300">no primeiro mês</span></p>
          <p className="mx-auto mb-8 max-w-xl text-slate-300">Depois, {PLAN_PRICE} por mês. Sem taxa de adesão e sem fidelidade. Cancele quando quiser.</p>
        </Reveal>
        <div className="mx-auto mb-8 max-w-xl rounded-xl border border-white/15 bg-white/5 p-5 text-left sm:p-6">
          <p className="mb-3 text-sm font-semibold text-slate-300">O que está incluso</p>
          <ul className="space-y-2.5">
            {included.map((i, n) => (
              <Reveal as="li" key={i} from="left" delay={n * 80} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">
                <Icon name="check" size={18} className="mt-0.5 shrink-0 text-lima" /> {i}
              </Reveal>
            ))}
          </ul>
        </div>
        <SignupCta className="glass-button-lime !w-auto">Quero fidelizar meus clientes</SignupCta>
      </section>

      {/* FAQ */}
      <section className="px-5 py-14 sm:px-8">
        <Reveal from="top">
          <h2 className="mb-3 max-w-2xl text-3xl font-semibold text-primary md:text-4xl">Tem dúvidas? Relaxa, nós temos as respostas.</h2>
          <p className="mb-8 max-w-xl text-slate-600">Separamos as perguntas que mais recebemos.</p>
        </Reveal>
        <Reveal from="bottom" className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
          {faqs.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex list-none items-center gap-4 py-4 font-semibold text-primary transition-colors hover:text-electric-600">
                <Icon name="plus" size={18} className="shrink-0 text-electric-500 transition-transform group-open:rotate-45" />
                {f.q}
              </summary>
              <p className="pb-4 pl-[2.1rem] text-slate-600">{f.a}</p>
            </details>
          ))}
        </Reveal>
      </section>

      <Hatch />

      <footer className="flex flex-col items-center gap-4 px-5 py-10 text-center text-sm text-slate-500">
        <Brand />
        <div className="flex gap-5 font-semibold text-primary">
          <Link href="/entrar" className="hover:text-electric-600">Sou cliente</Link>
          <Link href="/login" className="hover:text-electric-600">Entrar</Link>
          <SignupCta className="hover:text-electric-600">Assinar</SignupCta>
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/termos/estabelecimento" className="hover:text-electric-600">Termos para Estabelecimentos</Link>
          <Link href="/termos/cliente" className="hover:text-electric-600">Termos do Cliente</Link>
          <Link href="/privacidade" className="hover:text-electric-600">Política de Privacidade</Link>
        </p>
        <p>© {new Date().getFullYear()} Fidelize. Todos os direitos reservados.</p>
      </footer>
    </main>
  );
}
