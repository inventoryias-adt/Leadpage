import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { Icon, type IconName } from '@/components/Icons';
import { LeadForm } from '@/components/LeadForm';
import { LegalLinks } from '@/components/LegalLinks';
import { LEAD_SOURCES } from '@/lib/lead';
import { FIRST_MONTH_PRICE, PLAN_PRICE } from '@/lib/plan';

export const metadata = {
  title: 'Quero o Fidelize no meu negócio',
  description: 'Deixe o seu contato e a gente fala com você: clube de pontos, agenda e pedidos para o seu comércio.',
};

const BENEFITS: [IconName, string, string][] = [
  ['star', 'Clube de pontos com a sua marca', 'O cliente junta pontos a cada compra e troca por prêmios que você escolhe.'],
  ['clock', 'Agenda e pedidos pelo app', 'Hora marcada, reserva de mesa e pedido para retirar, tudo no celular dele.'],
  ['chart', 'Você enxerga quem volta', 'Painel simples com vendas, clientes que sumiram e ideias para vender mais.'],
];

export default async function QueroOFidelize({ searchParams }: { searchParams: Promise<{ origem?: string }> }) {
  const origem = (await searchParams).origem;
  const source = (LEAD_SOURCES as readonly string[]).includes(origem ?? '') ? (origem as string) : 'app';
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-5 py-8">
      <Brand href="/" />
      <section className="glass-panel p-6 sm:p-8">
        <p className="mb-2 inline-block rounded-full bg-[#c6f432] px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">Para comerciantes</p>
        <h1 className="mb-2 text-3xl font-extrabold leading-tight tracking-tight text-primary">Quer o Fidelize no seu negócio?</h1>
        <p className="mb-5 text-slate-600">Deixe o seu contato e a gente fala com você. Leva 1 minuto e não tem compromisso. O primeiro mês sai por {FIRST_MONTH_PRICE}; depois, {PLAN_PRICE} por mês, tudo incluso.</p>
        <ul className="mb-6 space-y-3">
          {BENEFITS.map(([icon, title, text]) => (
            <li key={title} className="flex items-start gap-3">
              <span className="icon-tile"><Icon name={icon} size={20} /></span>
              <span className="min-w-0 text-sm"><b className="block text-slate-800">{title}</b><span className="text-slate-600">{text}</span></span>
            </li>
          ))}
        </ul>
        <LeadForm source={source} />
      </section>
      <p className="text-center text-sm text-slate-500">
        Prefere ver antes? <Link href="/" className="link-inline">Conheça o Fidelize</Link> · Já é cliente do Fidelize? <Link href="/login" className="link-inline">Entrar no painel</Link>
      </p>
      <LegalLinks audience="estabelecimento" />
    </main>
  );
}
