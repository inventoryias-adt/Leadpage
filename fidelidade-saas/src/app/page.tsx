import Link from 'next/link';
import { SignupForm } from '@/components/AuthForms';

const steps = [
  { n: '1', title: 'O caixa lança a conta', text: 'Digita o valor gasto e marca se o cliente avaliou no Google ou postou no Instagram.' },
  { n: '2', title: 'Cliente lê o QR Code', text: 'Ou recebe o link no WhatsApp. Sem baixar app: abre direto no celular, em segundos.' },
  { n: '3', title: 'Pontos viram prêmios', text: 'O saldo fica na carteira digital do cliente e ele troca por produtos que você escolheu.' },
];

const benefits = [
  { icon: '⭐', title: 'Mais avaliações no Google', text: 'Pontos extras para quem avalia sua casa com 5 estrelas e fortalece seu ranking local.' },
  { icon: '📸', title: 'Divulgação orgânica', text: 'Clientes ganham pontos ao postar e marcar o restaurante no Instagram.' },
  { icon: '🔁', title: 'Cliente que volta', text: 'Saldo de pontos é motivo concreto para voltar — e para pedir mais da próxima vez.' },
  { icon: '🛡️', title: 'Controle antifraude', text: 'QR Code de uso único, validade de 24h e limite mensal de resgates por CPF.' },
  { icon: '📱', title: 'Feito para o balcão', text: 'Painel otimizado para celular e notebook: lançar pontos leva menos de 10 segundos.' },
  { icon: '⚙️', title: 'Você dita as regras', text: 'Defina a conversão (ex.: R$ 1 = 10 pontos), as interações e os prêmios.' },
];

const faqs = [
  { q: 'Preciso instalar algum aplicativo?', a: 'Não. O cliente usa um web app (PWA) pelo navegador e pode adicioná-lo à tela inicial se quiser.' },
  { q: 'Como funciona a cobrança?', a: 'Assinatura mensal de R$ 197,00, sem taxa de adesão. Você pode cancelar quando quiser.' },
  { q: 'Em quanto tempo começo a usar?', a: 'Assim que o pagamento é confirmado você configura o restaurante em poucos minutos e já pode pontuar.' },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-20">
      <nav className="flex items-center justify-between py-5">
        <span className="text-xl font-extrabold tracking-tight text-primary">Fidelize</span>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link href="/entrar" className="hidden text-slate-600 hover:text-primary sm:inline">Sou cliente</Link>
          <Link href="/login" className="glass-chip hover:bg-white">Entrar</Link>
        </div>
      </nav>

      {/* Hero + checkout */}
      <section className="grid items-center gap-10 py-8 md:grid-cols-2 md:py-14">
        <div>
          <span className="glass-chip mb-5">Programa de pontos para restaurantes</span>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight text-primary md:text-5xl">
            Fidelize clientes e multiplique o faturamento do seu restaurante.
          </h1>
          <p className="mb-6 text-lg text-slate-600">
            O sistema de recompensas mais simples do mercado: crie pontos, receba mais avaliações no
            Google e faça o cliente voltar sempre.
          </p>
          <div className="glass-panel-sm inline-block p-5">
            <p className="text-2xl font-extrabold text-electric-600">
              R$ 197,00 <span className="text-base font-semibold text-slate-500">/ mês</span>
            </p>
            <p className="text-sm text-slate-500">Sem taxa de adesão. Cancele quando quiser.</p>
          </div>
        </div>

        <div id="assinar" className="glass-panel p-6 sm:p-8">
          <h2 className="mb-1 text-2xl font-bold text-primary">Crie sua conta</h2>
          <p className="mb-6 text-sm text-slate-500">Leva 1 minuto. Depois você segue para o pagamento seguro.</p>
          <SignupForm />
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-12">
        <h2 className="mb-8 text-center text-3xl font-extrabold text-primary">Como funciona</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="glass-panel p-6">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-electric-500 font-bold text-white shadow-lg shadow-blue-500/30">
                {s.n}
              </span>
              <h3 className="mb-1 text-lg font-bold text-slate-800">{s.title}</h3>
              <p className="text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-12">
        <h2 className="mb-8 text-center text-3xl font-extrabold text-primary">Tudo o que seu restaurante precisa</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="glass-panel-sm p-5">
              <div className="mb-2 text-2xl" aria-hidden>{b.icon}</div>
              <h3 className="mb-1 font-bold text-slate-800">{b.title}</h3>
              <p className="text-sm text-slate-600">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Oferta */}
      <section className="py-12">
        <div className="glass-panel mx-auto max-w-xl p-8 text-center">
          <h2 className="mb-2 text-2xl font-extrabold text-primary">Um plano, tudo incluso</h2>
          <p className="my-4 text-5xl font-extrabold text-electric-600">
            R$ 197<span className="text-xl text-slate-500">,00/mês</span>
          </p>
          <p className="mb-6 text-slate-600">Clientes e resgates ilimitados · Painel de balcão · Carteira digital em PWA</p>
          <a href="#assinar" className="glass-button">Quero fidelizar meus clientes</a>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl py-12">
        <h2 className="mb-6 text-center text-3xl font-extrabold text-primary">Perguntas frequentes</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="glass-panel-sm group p-5">
              <summary className="cursor-pointer list-none font-semibold text-slate-800">{f.q}</summary>
              <p className="mt-2 text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="pt-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} Fidelize</footer>
    </main>
  );
}
