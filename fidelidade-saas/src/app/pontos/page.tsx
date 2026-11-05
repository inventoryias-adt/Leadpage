import type { Metadata } from 'next';
import { ClosingBand, FeatureSplit, PageHero, PublicFooter, PublicNav } from '@/components/PublicShell';
import { WalletMock } from '@/components/PublicMocks';
import { Icon, type IconName } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';

export const metadata: Metadata = {
  title: 'Pontos de fidelidade',
  description: 'Cada compra vira pontos na carteira digital do cliente e os pontos viram prêmios que você escolhe. Lance por CPF ou QR Code.',
};

const steps: { icon: IconName; title: string; text: string }[] = [
  { icon: 'cog', title: 'Você define as regras', text: 'Quanto vale cada R$ 1 em pontos (ex.: R$ 1 = 10 pontos) e quais prêmios o cliente pode ganhar.' },
  { icon: 'receipt', title: 'Você lança no caixa', text: 'Digite o valor da conta e o CPF do cliente. Se ele ainda não tem conta, gere um QR Code ou mande o link pelo WhatsApp.' },
  { icon: 'star', title: 'O cliente acompanha', text: 'Na carteira ele vê o saldo, quanto falta para o prêmio e o histórico de pontos.' },
  { icon: 'gift', title: 'Ele troca por prêmio', text: 'O app gera um código, ele mostra no balcão e você entrega o prêmio e dá baixa.' },
];

const control: { icon: IconName; title: string; text: string }[] = [
  { icon: 'lock', title: 'Controle antifraude', text: 'QR Code de uso único com validade e limite mensal de resgates por CPF.' },
  { icon: 'users', title: 'Clientes e resgates', text: 'Veja quem voltou, quem sumiu e filtre os resgates por cliente, data e prêmio.' },
  { icon: 'chart', title: 'Relatórios em planilha', text: 'Baixe o movimento do mês em CSV quando precisar.' },
];

export default function PontosPage() {
  return (
    <>
      <PublicNav current="/pontos" dark />
      <main className="overflow-x-clip">
        <PageHero icon="star" title="Pontos de fidelidade" text="Cada compra vira pontos na carteira do cliente, e os pontos viram prêmios que você escolhe. Sem cartãozinho de papel." />

        <FeatureSplit
          chip="Sistema de pontos"
          title="Cliente ganha pontos,"
          accent="você ganha cliente fiel."
          text="Quando o cliente tem saldo no seu lugar, ele tem um motivo concreto para escolher você de novo."
          items={[
            { icon: 'phone', title: 'Carteira no celular', text: 'Abre pelo link ou QR Code, sem baixar app.' },
            { icon: 'gift', title: 'Prêmios que você escolhe', text: 'Você define o que vale e quanto custa.' },
            { icon: 'receipt', title: 'Pontos como desconto', text: 'Em serviços agendados, o cliente usa pontos no valor.' },
          ]}
          cta="Quero pontos no meu negócio"
          mock={<WalletMock />}
        />

        <section className="bg-[#F6F7F9]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
            <Reveal from="top">
              <span className="micro mb-3 block">Como funciona</span>
              <h2 className="mb-10 max-w-2xl text-3xl font-extrabold tracking-tight text-primary md:text-4xl">Do balcão à carteira, em 4 passos<span className="text-electric-500">.</span></h2>
            </Reveal>
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <Reveal as="li" key={s.title} from="bottom" delay={i * 90} className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-electric-500 text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="mb-1 flex items-center gap-2 font-semibold text-primary"><Icon name={s.icon} size={18} className="text-electric-500" /> {s.title}</h3>
                  <p className="text-sm text-slate-600">{s.text}</p>
                </Reveal>
              ))}
            </ol>
            <Reveal from="bottom" className="mt-6 rounded-2xl border border-electric-500/30 bg-electric-500/5 p-5">
              <p className="micro mb-1 !text-electric-600">Exemplo</p>
              <p className="text-sm text-slate-700">Você define R$ 1 = 10 pontos e um prêmio de 1.500 pontos. A Maria gasta R$ 80 e ganha 800 pontos. Na próxima visita, mais R$ 80 e o saldo vai a 1.600: ela troca por um prêmio e já sai com um motivo para voltar.</p>
            </Reveal>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
            <Reveal from="left">
              <span className="micro mb-3 block">Você no controle</span>
              <h2 className="mb-10 max-w-2xl text-3xl font-extrabold tracking-tight text-primary md:text-4xl">Pontos com regra, limite e relatório<span className="text-electric-500">.</span></h2>
            </Reveal>
            <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
              {control.map((b, i) => (
                <Reveal key={b.title} from="bottom" delay={i * 90} className="border-l-2 border-electric-500 pl-5">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600"><Icon name={b.icon} size={22} /></span>
                  <h3 className="mb-1 font-semibold text-primary">{b.title}</h3>
                  <p className="text-sm text-slate-600">{b.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <ClosingBand title="Comece a pontuar hoje." text="Configure o seu lugar em poucos minutos e lance os primeiros pontos ainda hoje." />
      </main>
      <PublicFooter />
    </>
  );
}
