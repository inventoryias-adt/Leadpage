import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { TERMS_HREF, TERMS_TITLE } from '@/lib/legal';

export const metadata = { title: 'Termos de Uso', description: 'Os dois Termos de Uso do Fidelize: um para estabelecimentos e outro para clientes.' };

/** Os termos são dois, porque quem contrata o serviço e quem ganha os pontos têm direitos e deveres diferentes. */
export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso">
      <p>O Fidelize tem dois Termos de Uso. Escolha o que vale para você:</p>
      <ul className="!list-none !pl-0 space-y-3">
        <li>
          <Link href={TERMS_HREF.estabelecimento} className="glass-panel-sm card-link block p-4 no-underline">
            <span className="block font-bold text-primary">{TERMS_TITLE.estabelecimento}</span>
            <span className="block text-sm text-slate-600">Para quem contrata o Fidelize: assinatura, responsabilidades com prêmios e dados dos clientes, campanhas e pontos compartilhados.</span>
          </Link>
        </li>
        <li>
          <Link href={TERMS_HREF.cliente} className="glass-panel-sm card-link block p-4 no-underline">
            <span className="block font-bold text-primary">{TERMS_TITLE.cliente}</span>
            <span className="block text-sm text-slate-600">Para quem ganha e troca pontos: conta, pontos, resgates, pontos compartilhados, agendamentos e localização.</span>
          </Link>
        </li>
      </ul>
      <p>Os dois seguem a mesma <Link href="/privacidade" className="link-inline">Política de Privacidade</Link>.</p>
    </LegalPage>
  );
}
