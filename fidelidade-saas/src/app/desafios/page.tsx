import type { Metadata } from 'next';
import { ClosingBand, FeatureSplit, PageHero, PublicFooter, PublicNav } from '@/components/PublicShell';
import { ChallengesMock } from '@/components/PublicMocks';
import { Icon, type IconName } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';

export const metadata: Metadata = {
  title: 'Desafios e campanhas',
  description: 'Crie desafios de compras e de visitas, campanhas de pontos em dobro e bônus por dia e horário para o seu cliente voltar mais vezes.',
};

const kinds: { icon: IconName; title: string; text: string; example: string }[] = [
  { icon: 'receipt', title: 'Desafio de compras', text: 'O cliente faz um número de compras na semana ou no mês, com valor mínimo opcional por compra.', example: '“Compre 3x esta semana e ganhe 500 pontos.”' },
  { icon: 'pin', title: 'Desafio de visitas', text: 'Conta os check-ins por proximidade: o cliente precisa estar no lugar, no máximo um por dia.', example: '“Venha 4x este mês e ganhe 300 pontos.”' },
  { icon: 'spark', title: 'Campanha de pontos', text: 'Multiplicador (2x) ou pontos extras, por período, dia da semana e horário.', example: '“Terça e quinta em dobro.”' },
  { icon: 'users', title: 'Indicação de amigos', text: 'Quem indica ganha pontos quando o amigo faz a primeira compra. Você define quantos.', example: '“Indique um amigo e ganhe 100 pontos.”' },
];

export default function DesafiosPage() {
  return (
    <>
      <PublicNav current="/desafios" dark />
      <main className="overflow-x-clip">
        <PageHero icon="target" title="Desafios e campanhas" text="Crie metas que fazem o seu cliente voltar: por compras, por visitas ou por dia da semana. O app acompanha o progresso e entrega o bônus." />

        <FeatureSplit
          chip="Desafios"
          title="Desafios que fazem o"
          accent="cliente voltar."
          text="Quando o cliente vê “2 de 3 compras”, ele sabe exatamente o que falta para ganhar. Cada desafio premia uma vez por cliente em cada período."
          items={[
            { icon: 'target', title: 'Meta e prazo claros', text: 'Semana ou mês, com a quantidade que você escolher.' },
            { icon: 'star', title: 'Bônus em pontos', text: 'O prêmio cai na carteira quando o cliente completa.' },
            { icon: 'bell', title: 'Aparece no app', text: 'O cliente acompanha o progresso na página do seu lugar.' },
          ]}
          cta="Quero criar desafios"
          mock={<ChallengesMock />}
          tone="gray"
        />

        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
            <Reveal from="top">
              <span className="micro mb-3 block">Tipos de incentivo</span>
              <h2 className="mb-10 max-w-2xl text-3xl font-extrabold tracking-tight text-primary md:text-4xl">Quatro formas de dar motivo para voltar<span className="text-electric-500">.</span></h2>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2">
              {kinds.map((k, i) => (
                <Reveal key={k.title} from={i % 2 === 0 ? 'left' : 'right'} delay={Math.floor(i / 2) * 100} className="flex gap-4 rounded-2xl border border-[#E5E7EB] p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600"><Icon name={k.icon} size={22} /></span>
                  <div>
                    <h3 className="mb-1 font-semibold text-primary">{k.title}</h3>
                    <p className="mb-2 text-sm text-slate-600">{k.text}</p>
                    <p className="text-sm italic text-slate-500">{k.example}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <ClosingBand title="Dê um objetivo ao seu cliente." text="Monte o primeiro desafio em poucos minutos, na aba Regras do painel." />
      </main>
      <PublicFooter />
    </>
  );
}
