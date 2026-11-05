import type { Metadata } from 'next';
import { ClosingBand, PageHero, PublicFooter, PublicNav, SignupLink } from '@/components/PublicShell';
import { Icon } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { FIRST_MONTH_PRICE, PLAN_PRICE } from '@/lib/plan';

export const metadata: Metadata = {
  title: 'Preços',
  description: `Um plano com tudo incluso: ${FIRST_MONTH_PRICE} no primeiro mês e depois ${PLAN_PRICE} por mês, sem taxa de adesão e sem fidelidade.`,
};

const included = [
  'Clientes, lançamentos e resgates ilimitados',
  'Pontos por CPF ou QR Code, no celular e no computador',
  'Carteira digital do cliente, sem baixar app',
  'Prêmios, cupons e pontos como desconto',
  'Desafios, campanhas e indicação de amigos',
  'Check-in por proximidade',
  'Pontos por Instagram e avaliações, com aprovação',
  'Agenda, reservas e equipe com lembrete ao cliente',
  'Pedidos com retirada e cardápio',
  'Clientes, resgates e relatórios em planilha',
  'Antifraude: QR de uso único e limite por CPF',
  'Várias unidades na mesma conta',
];

export default function PrecosPage() {
  return (
    <>
      <PublicNav current="/precos" dark />
      <main className="overflow-x-clip">
        <PageHero icon="receipt" title="Preços" text="Um plano só, com todas as funções incluídas. Sem taxa de adesão e sem fidelidade." />

        <section className="bg-[#F6F7F9]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
            <Reveal from="zoom" className="mx-auto max-w-lg">
              <div data-testid="plano-lancamento" className="relative rounded-3xl border-2 border-lima bg-primary p-7 text-white shadow-[0_30px_60px_-30px_rgba(18,40,107,0.5)] sm:p-9">
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-lima px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-primary">Preço de lançamento</span>
                <p className="micro !text-slate-300">Plano completo</p>
                <p className="mt-2 flex items-end gap-2 text-lima">
                  <span className="text-6xl font-extrabold leading-none tracking-tight">{FIRST_MONTH_PRICE}</span>
                  <span className="pb-1.5 text-base font-semibold text-slate-300">no primeiro mês</span>
                </p>
                <p className="mt-3 text-slate-300">Depois, <strong className="text-white">{PLAN_PRICE}</strong> por mês. Cancele quando quiser.</p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {['Todas as funções incluídas', 'Clientes e resgates ilimitados', 'Sem taxa de adesão', 'Sem fidelidade'].map((t) => (
                    <li key={t} className="flex items-center gap-3 font-medium">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lima text-primary"><Icon name="check" size={13} strokeWidth={3} /></span> {t}
                    </li>
                  ))}
                </ul>
                <SignupLink className="glass-button-lime mt-8">Começar agora</SignupLink>
              </div>
              <p className="mt-4 text-center text-xs text-slate-500">Valores de lançamento. Qualquer mudança futura de preço é avisada com antecedência dentro do app.</p>
            </Reveal>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8 md:py-20">
            <Reveal from="left">
              <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-primary md:text-3xl">O que está incluso<span className="text-electric-500">.</span></h2>
              <p className="mb-8 text-slate-600">Aqui você não paga por função. Tudo o que o Fidelize faz está no plano.</p>
            </Reveal>
            <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {included.map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-600">
                  <Icon name="check" size={18} className="mt-0.5 shrink-0 text-electric-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-[#E5E7EB] bg-[#F6F7F9]">
          <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8 md:py-20">
            <Reveal from="bottom">
              <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-primary md:text-3xl">Quanto custa perder um cliente<span className="text-electric-500">?</span></h2>
              <p className="mb-4 text-slate-600">
                Conquistar um cliente novo pode custar bem mais do que manter um que já compra de você: o Sebrae fala em até cinco vezes, e a Harvard Business Review cita de 5 a 25 vezes, conforme o setor.
              </p>
              <p className="mb-4 text-slate-600">
                Um exemplo de conta: se o seu ticket médio é R$ 50 e um cliente volta 2 vezes por mês, ele vale R$ 1.200 por ano. Com o plano a {PLAN_PRICE} por mês, bastam <strong className="text-primary">2 compras a mais por mês</strong> de clientes que voltaram pelos pontos para ele se pagar.
              </p>
              <p className="text-xs text-slate-500">É uma conta de exemplo, com valores que você ajusta ao seu negócio. Não é promessa de resultado.</p>
            </Reveal>
          </div>
        </section>

        <ClosingBand title="Comece pelo primeiro mês." text={`${FIRST_MONTH_PRICE} no primeiro mês, sem taxa de adesão e sem fidelidade.`} />
      </main>
      <PublicFooter />
    </>
  );
}
