import Link from 'next/link';
import { LegalPage, SupportContactLine, operatorLine } from '@/components/LegalPage';
import { PLAN_PRICE } from '@/lib/plan';

export const metadata = { title: 'Termos de Uso', description: 'Regras de uso do Fidelize para estabelecimentos e clientes.' };

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso">
      <p>
        Estes Termos de Uso regulam o uso do Fidelize, plataforma de pontos e prêmios operada por {operatorLine()}. Ao criar uma conta ou usar o serviço,
        você declara que leu e concorda com eles e com a <Link href="/privacidade" className="link-inline">Política de Privacidade</Link>.
      </p>

      <h2>1. O que é o Fidelize</h2>
      <p>
        O Fidelize permite que <strong>estabelecimentos</strong> (restaurantes, lojas, salões e outros) criem um programa de pontos para seus clientes, e que
        <strong> clientes</strong> acumulem pontos, acompanhem prêmios e troquem seus pontos nos lugares que participam. O Fidelize fornece a tecnologia; o programa
        de cada lugar (regras, prêmios e campanhas) é definido e mantido pelo próprio estabelecimento.
      </p>

      <h2>2. Quem pode usar</h2>
      <ul>
        <li>Estabelecimentos: pessoas jurídicas ou profissionais autônomos com poderes para contratar em nome do negócio.</li>
        <li>Clientes: pessoas com 18 anos ou mais. Menores só podem usar com acompanhamento e autorização de um responsável.</li>
      </ul>

      <h2>3. Cadastro e segurança da conta</h2>
      <p>
        Você deve informar dados verdadeiros e mantê-los atualizados. A senha é pessoal: não a compartilhe. Você é responsável pelas ações feitas com a sua conta.
        Se suspeitar de uso indevido, avise o suporte imediatamente. Podemos pedir a confirmação dos dados quando houver indício de fraude.
      </p>

      <h2>4. Assinatura, preço e pagamento (estabelecimentos)</h2>
      <ul>
        <li>O plano é mensal, por assinatura recorrente, no valor exibido no momento da contratação (hoje {PLAN_PRICE} por mês), sem taxa de adesão e sem fidelidade.</li>
        <li>A cobrança é feita pelo Stripe, processador de pagamentos. O Fidelize não armazena os dados completos do seu cartão.</li>
        <li>Reajustes de preço serão comunicados com pelo menos 30 dias de antecedência, e você poderá cancelar antes de passarem a valer.</li>
        <li>Se o pagamento falhar, o acesso ao painel e às funções que dependem da assinatura pode ser suspenso até a regularização.</li>
      </ul>

      <h2>5. Cancelamento e reembolso</h2>
      <p>
        Você pode cancelar a assinatura a qualquer momento, pelo painel (Regras → Minha conta → “Gerenciar assinatura e faturas”) ou pelo suporte, sem multa. O acesso continua
        até o fim do período já pago. Em regra, não há reembolso proporcional do período em curso, ressalvados os direitos garantidos por lei, como o de arrependimento em até
        7 dias da contratação quando a legislação de defesa do consumidor se aplicar.
      </p>

      <h2>6. Pontos, prêmios e campanhas</h2>
      <ul>
        <li>Pontos são um benefício de fidelidade do estabelecimento. <strong>Não são dinheiro</strong>, não geram direito a saque ou reembolso e só valem conforme as regras do lugar em que foram ganhos.</li>
        <li>Cada estabelecimento define quanto cada compra rende, quais prêmios existem, quanto custam, limites de resgate e campanhas. Ele pode alterar essas regras e é responsável por comunicá-las aos clientes e por entregar os prêmios resgatados.</li>
        <li>O Fidelize não vende os produtos e não é parte da relação de consumo entre o cliente e o estabelecimento. Dúvidas sobre o prêmio ou a compra devem ser resolvidas com o estabelecimento.</li>
        <li>Pontos creditados por erro, fraude ou abuso poderão ser estornados.</li>
      </ul>

      <h2>7. Pontos compartilhados entre lugares</h2>
      <p>
        Quando um estabelecimento ativa o compartilhamento, os pontos ganhos nele poderão ser usados em outros lugares que aceitem pontos de terceiros, conforme as regras de
        conversão e de uso informadas na plataforma no momento em que o recurso for liberado. Cada lugar escolhe participar ou não e pode desligar a opção a qualquer momento.
      </p>

      <h2>8. Uso adequado</h2>
      <p>É proibido: lançar compras falsas ou usar QR Codes de forma indevida; burlar limites; acessar contas de terceiros; automatizar o acesso (robôs, coleta em massa de dados); enviar conteúdo ilícito, ofensivo ou que viole direitos de terceiros; ou tentar comprometer a segurança do serviço.</p>

      <h2>9. Conteúdo do estabelecimento</h2>
      <p>
        Logos, fotos, nomes de produtos e textos que você enviar continuam sendo seus. Você declara ter o direito de usá-los e nos autoriza a exibi-los na plataforma para o funcionamento do serviço.
        Ao buscar fotos de produtos na internet, você é responsável por verificar se pode usá-las.
      </p>

      <h2>10. Disponibilidade e suporte</h2>
      <p>
        Trabalhamos para manter o serviço disponível, mas podem ocorrer interrupções por manutenção, falhas de terceiros (internet, hospedagem, meios de pagamento) ou causas fora do nosso controle.
        O suporte funciona por e-mail e WhatsApp, em horário comercial, com resposta o mais rápido possível.
      </p>

      <h2>11. Limitação de responsabilidade</h2>
      <p>
        Na medida permitida pela lei, o Fidelize não responde por prejuízos indiretos, lucros cessantes ou perda de oportunidades decorrentes do uso ou da indisponibilidade do serviço, nem por atos
        e omissões dos estabelecimentos perante os clientes. Nossa responsabilidade total perante um estabelecimento fica limitada ao valor pago por ele nos últimos 12 meses, salvo quando a lei dispuser de modo diferente.
      </p>

      <h2>12. Suspensão e encerramento</h2>
      <p>Podemos suspender ou encerrar contas que violem estes Termos, causem risco a outros usuários ou à plataforma, ou estejam envolvidas em fraude, avisando sempre que possível. Você pode encerrar a sua conta a qualquer momento pedindo ao suporte.</p>

      <h2>13. Alterações nestes Termos</h2>
      <p>Podemos atualizar estes Termos. Mudanças relevantes serão avisadas pelo app ou por e-mail. Continuar usando o serviço depois do aviso significa concordar com a nova versão.</p>

      <h2>14. Lei aplicável e foro</h2>
      <p>Estes Termos seguem a lei brasileira. Quando houver relação de consumo, fica eleito o foro do domicílio do consumidor; nos demais casos, o foro da comarca do domicílio do Fidelize.</p>

      <h2>15. Contato</h2>
      <SupportContactLine />
    </LegalPage>
  );
}
