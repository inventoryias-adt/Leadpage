import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { Icon, type IconName } from '@/components/Icons';
import { Illustration } from '@/components/Illustrations';
import { LandingMock } from '@/components/LandingMock';
import { SignupForm } from '@/components/AuthForms';

const steps = [
  { n: '1', variant: 'qr' as const, title: 'O caixa lança a conta', text: 'Ele digita o valor gasto e marca se o cliente avaliou no Google ou postou no Instagram.' },
  { n: '2', variant: 'places' as const, title: 'Cliente lê o QR Code', text: 'Ou recebe o link no WhatsApp. Sem baixar app: abre direto no celular, em segundos.' },
  { n: '3', variant: 'gift' as const, title: 'Pontos viram prêmios', text: 'O saldo fica na carteira digital do cliente e ele troca por produtos que você escolheu.' },
];

const benefits = [
  { icon: 'star' as IconName, title: 'Mais avaliações no Google', text: 'Pontos extras para quem avalia sua casa com 5 estrelas e fortalece seu ranking local.' },
  { icon: 'camera' as IconName, title: 'Divulgação orgânica', text: 'Clientes ganham pontos ao postar e marcar o estabelecimento no Instagram.' },
  { icon: 'trophy' as IconName, title: 'Cliente que volta', text: 'Saldo de pontos é motivo concreto para voltar — e para pedir mais da próxima vez.' },
  { icon: 'lock' as IconName, title: 'Controle antifraude', text: 'QR Code de uso único, validade de 24h e limite mensal de resgates por CPF.' },
  { icon: 'receipt' as IconName, title: 'Feito para o balcão', text: 'Painel otimizado para celular e computador: lançar pontos leva menos de 10 segundos.' },
  { icon: 'cog' as IconName, title: 'Você dita as regras', text: 'Defina a conversão (ex.: R$ 1 = 10 pontos), desafios, check-in, indicação e prêmios.' },
];

const included = [
  'Clientes e resgates ilimitados',
  'Painel de balcão no celular e no computador',
  'Carteira digital do cliente, sem baixar app',
  'Várias unidades na mesma conta',
  'Desafios, check-in por localização e indicação de amigos',
];

const faqs = [
  { q: 'Preciso instalar algum aplicativo?', a: 'Não. O cliente usa um web app (PWA) pelo navegador e pode adicioná-lo à tela inicial se quiser.' },
  { q: 'Como funciona a cobrança?', a: 'Assinatura mensal de R$ 197,00, sem taxa de adesão. Você pode cancelar quando quiser.' },
  { q: 'Em quanto tempo começo a usar?', a: 'Assim que o pagamento é confirmado você configura o estabelecimento em poucos minutos e já pode pontuar.' },
  { q: 'Funciona para outros negócios além de restaurante?', a: 'Sim. Cafeterias, padarias, açaí, sorveterias, barbearias e qualquer lugar com balcão podem usar.' },
  { q: 'Tenho mais de uma loja. Posso usar?', a: 'Pode. Cada unidade tem endereço, horário e localização próprios, e os pontos valem em todas.' },
];

/** Linha fina entre as seções. */
function Hatch() {
  return <div aria-hidden className="h-px bg-[#E5E7EB]" />;
}

/** Botão principal de chamada para ação. */
function Cta({ href, children }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <a href={href} className="glass-button !w-auto !px-6 !py-3 !text-base">
      {children}
      <Icon name="chevron" size={16} />
    </a>
  );
}

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl overflow-x-clip border-x border-[#E5E7EB] bg-white">
      <nav className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Brand />
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link href="/entrar" className="nav-tab hidden sm:inline-block">Sou cliente</Link>
          <Link href="/login" className="chip-link">Entrar</Link>
        </div>
      </nav>

      <div aria-hidden className="h-px bg-[#E5E7EB]" />

      {/* Hero + cadastro */}
      <section className="grid items-center gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.1fr_1fr] md:py-16">
        <div>
          <span className="glass-chip mb-6 !px-3 !py-1.5 !text-[13px]">
            Programa de pontos para restaurantes e comércios
          </span>
          <h1 className="mb-5 text-4xl font-semibold leading-[1.05] text-primary md:text-6xl">
            Fidelize seus clientes.
            <span className="block text-electric-500">Faça eles voltarem.</span>
          </h1>
          <p className="mb-8 max-w-xl text-lg text-slate-600">
            Pontos, prêmios e desafios num só lugar: o cliente lê um QR Code, acumula pontos na carteira digital e troca por produtos que você escolhe. Sem app para baixar.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <Cta href="#assinar">Começar agora</Cta>
            <p className="text-sm text-slate-500">
              <span className="text-2xl font-semibold text-primary">R$ 197,00</span> / mês · sem taxa de adesão
            </p>
          </div>
        </div>

        <div id="assinar" className="glass-panel p-6 sm:p-8">
          <h2 className="mb-1 text-2xl font-semibold text-primary">Crie sua conta</h2>
          <p className="mb-6 text-sm text-slate-500">Leva 1 minuto. Depois você segue para o pagamento seguro.</p>
          <SignupForm />
        </div>
      </section>

      {/* Vitrine do produto */}
      <section className="relative overflow-hidden border-y border-[#E5E7EB] bg-[#F6F7F9] px-5 py-14 sm:px-8">
        <div className="relative">
          <LandingMock />
        </div>
      </section>

      <Hatch />

      {/* Como funciona */}
      <section className="px-5 py-14 sm:px-8">
        <span className="glass-chip mb-4">Como funciona</span>
        <h2 className="mb-10 max-w-2xl text-3xl font-semibold text-primary md:text-4xl">Do balcão à carteira do cliente em três passos.</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <div className="flex justify-center border-b border-[#E5E7EB] bg-[#F6F7F9] py-6">
                <Illustration variant={s.variant} size={150} />
              </div>
              <div className="p-5">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-electric-500">Passo {s.n}</p>
                <h3 className="mb-1 text-lg font-semibold text-primary">{s.title}</h3>
                <p className="text-sm text-slate-600">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Hatch />

      {/* Benefícios */}
      <section className="px-5 py-14 sm:px-8">
        <span className="glass-chip mb-4">Tudo incluso</span>
        <h2 className="mb-10 max-w-2xl text-3xl font-semibold text-primary md:text-4xl">Tudo o que o seu negócio precisa para o cliente voltar.</h2>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="border-l-2 border-electric-500 pl-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600"><Icon name={b.icon} size={22} /></span>
              <h3 className="mb-1 text-lg font-semibold text-primary">{b.title}</h3>
              <p className="text-sm text-slate-600">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Preço */}
      <section className="bg-dots-dark relative overflow-hidden bg-primary px-5 py-16 text-center sm:px-8">
        <h2 className="mx-auto mb-3 max-w-2xl text-3xl font-semibold text-white md:text-4xl">
          Um plano, tudo incluso. <span className="text-[#9DB7F5]">R$ 197,00 por mês.</span>
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-slate-300">Sem taxa de adesão e sem fidelidade. Cancele quando quiser.</p>
        <div className="mx-auto mb-8 max-w-xl rounded-xl border border-white/15 bg-white/5 p-5 text-left sm:p-6">
          <p className="mb-3 text-sm font-semibold text-slate-300">O que está incluso</p>
          <ul className="space-y-2.5">
            {included.map((i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">
                <Icon name="check" size={18} className="mt-0.5 shrink-0 text-[#9DB7F5]" /> {i}
              </li>
            ))}
          </ul>
        </div>
        <a href="#assinar" className="glass-button !w-auto !border-white !bg-white !px-6 !py-3 !text-primary hover:!bg-slate-100">Quero fidelizar meus clientes</a>
      </section>

      {/* FAQ */}
      <section className="px-5 py-14 sm:px-8">
        <h2 className="mb-3 max-w-2xl text-3xl font-semibold text-primary md:text-4xl">Tem dúvidas? Relaxa, nós temos as respostas.</h2>
        <p className="mb-8 max-w-xl text-slate-600">Separamos as perguntas que mais recebemos.</p>
        <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
          {faqs.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex list-none items-center gap-4 py-4 font-semibold text-primary transition-colors hover:text-electric-600">
                <Icon name="plus" size={18} className="shrink-0 text-electric-500 transition-transform group-open:rotate-45" />
                {f.q}
              </summary>
              <p className="pb-4 pl-[2.1rem] text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Hatch />

      <footer className="flex flex-col items-center gap-4 px-5 py-10 text-center text-sm text-slate-500">
        <Brand />
        <div className="flex gap-5 font-semibold text-primary">
          <Link href="/entrar" className="hover:text-electric-600">Sou cliente</Link>
          <Link href="/login" className="hover:text-electric-600">Entrar</Link>
          <a href="#assinar" className="hover:text-electric-600">Assinar</a>
        </div>
        <p>© {new Date().getFullYear()} Fidelize. Todos os direitos reservados.</p>
      </footer>
    </main>
  );
}
