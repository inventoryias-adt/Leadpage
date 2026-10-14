import Link from 'next/link';
import { LegalPage, SupportContactLine, operatorLine } from '@/components/LegalPage';

export const metadata = { title: 'Política de Privacidade', description: 'Como o Fidelize trata dados pessoais, conforme a LGPD.' };

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade">
      <p>
        Esta política explica como {operatorLine()} trata dados pessoais ao operar o Fidelize, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).
        Ela vale para estabelecimentos (donos e equipes) e para clientes. Leia também os <Link href="/termos/estabelecimento" className="link-inline">Termos de Uso para Estabelecimentos</Link> e os <Link href="/termos/cliente" className="link-inline">Termos de Uso do Cliente</Link>.
      </p>

      <h2>1. Quem é o controlador e como falar conosco</h2>
      <p>O Fidelize é o controlador dos dados tratados para manter as contas e a plataforma. Dúvidas, pedidos e reclamações sobre dados pessoais:</p>
      <SupportContactLine />

      <h2>2. Quais dados tratamos</h2>
      <p><strong>Clientes</strong></p>
      <ul>
        <li>Nome, CPF, telefone, e-mail e senha (guardada somente em forma de hash, nunca em texto).</li>
        <li>Carteiras e histórico: pontos ganhos e usados, compras lançadas (valor e data), prêmios resgatados, desafios, check-ins (data, unidade e distância até o local) e indicações de amigos.</li>
        <li>Localização aproximada <strong>apenas no momento</strong> em que você usa o check-in ou “Lugares perto de você”. Não guardamos o seu trajeto: do check-in fica registrado só o dia, a unidade e a distância.</li>
        <li>Preferências no aparelho (por exemplo, se você já viu o tutorial ou o aviso para adicionar o app à tela inicial).</li>
      </ul>
      <p><strong>Estabelecimentos</strong></p>
      <ul>
        <li>Nome do negócio, e-mail, telefone, senha (hash), endereços, horários, fotos e textos que você cadastra.</li>
        <li>Dados de cobrança tratados pelo Stripe (o Fidelize guarda apenas identificadores da assinatura, não o número do cartão).</li>
      </ul>
      <p><strong>Dados técnicos</strong>: endereço IP e registros de acesso, usados para segurança (por exemplo, limitar tentativas de login) e para identificar falhas.</p>

      <h2>3. Para que usamos e em qual base legal</h2>
      <ul>
        <li><strong>Prestar o serviço</strong> (criar a conta, pontuar, resgatar prêmios, cobrar a assinatura): execução de contrato.</li>
        <li><strong>Segurança e prevenção a fraudes</strong> (limites de tentativas, conferência de CPF e telefone, estorno de pontos indevidos): legítimo interesse e prevenção à fraude.</li>
        <li><strong>Avisos do serviço</strong> (recuperação de senha, confirmações, mensagens do seu estabelecimento): execução de contrato e legítimo interesse.</li>
        <li><strong>Localização</strong>: consentimento, dado ao permitir o acesso no seu aparelho; você pode negar ou revogar nas configurações do navegador.</li>
        <li><strong>Cumprir obrigações legais e exercer direitos</strong> (guarda de registros fiscais e de pagamento, defesa em processos).</li>
      </ul>
      <p>Não vendemos seus dados e não os usamos para publicidade de terceiros.</p>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li><strong>Os estabelecimentos onde você tem carteira</strong>: veem os dados necessários para operar o programa deles, como nome, telefone, CPF (parcialmente oculto no painel), pontos, compras e resgates naquele lugar. Cada estabelecimento é responsável pelo uso que faz desses dados no seu programa.</li>
        <li><strong>Operadores que nos prestam serviço</strong>: hospedagem e banco de dados (Vercel e Supabase), pagamentos (Stripe) e envio de e-mails. Eles só tratam os dados para nos atender.</li>
        <li><strong>Busca de fotos de produtos</strong>: o painel pode consultar bases públicas (Bluesoft Cosmos e Open Food Facts) usando o nome ou o código de barras do produto; nenhum dado pessoal é enviado.</li>
        <li><strong>Autoridades</strong>, quando a lei exigir.</li>
      </ul>

      <h2>5. Onde os dados ficam e como os protegemos</h2>
      <p>
        Os dados ficam em provedores de nuvem que podem manter servidores no Brasil ou no exterior; nesses casos adotamos contratos e salvaguardas compatíveis com a LGPD.
        Usamos conexão segura (HTTPS), senhas protegidas por hash, limite de tentativas de acesso e acesso restrito aos dados. Nenhum sistema é totalmente imune; em caso de incidente
        com risco relevante, avisaremos os afetados e a ANPD, conforme a lei.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>
        Enquanto a conta existir e for necessária para o serviço. Ao encerrar a conta, apagamos ou anonimizamos os dados em prazo razoável, exceto o que precisarmos manter para cumprir
        obrigações legais, resolver disputas ou prevenir fraude.
      </p>

      <h2>7. Seus direitos</h2>
      <p>
        Você pode pedir: confirmação de que tratamos seus dados; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; informação sobre
        compartilhamentos; eliminação dos dados tratados com consentimento; e revogação do consentimento. Também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        Para exercer seus direitos, <strong>escreva pelo contato acima</strong> informando seu nome e o e-mail ou CPF da conta; respondemos em até 15 dias. Para excluir sua conta de cliente ou de
        estabelecimento, use o mesmo contato.
      </p>

      <h2>8. Cookies e armazenamento no aparelho</h2>
      <p>
        Usamos um cookie de sessão, essencial para você continuar conectado, e o armazenamento local do navegador para lembrar preferências simples (tutorial visto, aviso para adicionar o app à tela inicial).
        Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros.
      </p>

      <h2>9. Crianças e adolescentes</h2>
      <p>O serviço é voltado a maiores de 18 anos. Se soubermos que dados de um menor foram informados sem autorização de um responsável, eles serão removidos.</p>

      <h2>10. Mudanças nesta política</h2>
      <p>Podemos atualizar esta política. Mudanças relevantes serão avisadas pelo app ou por e-mail, e a data no topo desta página mostra a versão em vigor.</p>
    </LegalPage>
  );
}
