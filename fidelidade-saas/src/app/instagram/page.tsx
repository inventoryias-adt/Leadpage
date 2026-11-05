import type { Metadata } from 'next';
import { ClosingBand, FeatureSplit, PageHero, PublicFooter, PublicNav } from '@/components/PublicShell';
import { InstagramMock } from '@/components/PublicMocks';
import { Icon, type IconName } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';

export const metadata: Metadata = {
  title: 'Instagram e divulgação',
  description: 'Dê pontos para quem posta e marca o seu lugar no Instagram ou avalia no Google. O cliente toca em “Já fiz” e você confere antes de liberar.',
};

const how: { icon: IconName; title: string; text: string }[] = [
  { icon: 'list', title: 'Você cria a regra', text: 'Ex.: “Story marcando o lugar = 50 pontos” ou “Avaliação 5★ no Google = 30 pontos”. Você escolhe os pontos.' },
  { icon: 'camera', title: 'O cliente posta e marca', text: 'Ele publica, marca o seu perfil e toca em “Já fiz” no app.' },
  { icon: 'check', title: 'Você confere e libera', text: 'Veja o post no Instagram e aprove ou recuse. Se preferir, os pontos entram sozinhos em 24 horas, a menos que você recuse antes.' },
];

export default function InstagramPage() {
  return (
    <>
      <PublicNav current="/instagram" dark />
      <main className="overflow-x-clip">
        <PageHero icon="camera" title="Instagram e divulgação" text="Transforme o cliente satisfeito em divulgação: pontos para quem posta, marca o seu lugar ou avalia no Google, com você no controle." />

        <FeatureSplit
          chip="Divulgação"
          title="Post vira ponto."
          accent="Cliente vira divulgação."
          text="Quem posta e marca o seu lugar ganha pontos e quem vê o post conhece o seu negócio. Você decide quanto vale e confere antes de liberar."
          items={[
            { icon: 'star', title: 'Pontos por interação', text: 'Instagram, Google ou qualquer ação que você definir.' },
            { icon: 'lock', title: 'Você confere', text: 'Aprovação manual, automática em 24 h ou só no balcão.' },
            { icon: 'share', title: 'Indicações com @', text: 'O cliente mostra o @ e quem gostar abre o perfil dele.' },
          ]}
          cta="Quero mais divulgação"
          mock={<InstagramMock />}
          reverse
          tone="gray"
        />

        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
            <Reveal from="top">
              <span className="micro mb-3 block">Como funciona</span>
              <h2 className="mb-10 max-w-2xl text-3xl font-extrabold tracking-tight text-primary md:text-4xl">Em três passos, sem integração complicada<span className="text-electric-500">.</span></h2>
            </Reveal>
            <ol className="grid gap-5 md:grid-cols-3">
              {how.map((s, i) => (
                <Reveal as="li" key={s.title} from="bottom" delay={i * 100} className="rounded-2xl border border-[#E5E7EB] p-5">
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-electric-500 text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="mb-1 flex items-center gap-2 font-semibold text-primary"><Icon name={s.icon} size={18} className="text-electric-500" /> {s.title}</h3>
                  <p className="text-sm text-slate-600">{s.text}</p>
                </Reveal>
              ))}
            </ol>
            <p className="mt-6 max-w-3xl text-xs text-slate-500">
              O Fidelize não lê o Instagram por conta própria: quem confirma que o post foi feito é você (ou o prazo automático que você escolher). Assim os pontos só saem para quem de fato divulgou.
            </p>
          </div>
        </section>

        <ClosingBand title="Faça o seu cliente falar de você." text="Crie a primeira regra de interação em poucos minutos, na aba Regras do painel." />
      </main>
      <PublicFooter />
    </>
  );
}
