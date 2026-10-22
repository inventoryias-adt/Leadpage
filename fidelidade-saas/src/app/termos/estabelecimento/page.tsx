import Link from 'next/link';
import { LegalPage, SupportContactLine, operatorLine } from '@/components/LegalPage';
import { FIRST_MONTH_PRICE, PLAN_PRICE } from '@/lib/plan';

export const metadata = { title: 'Termos de Uso para Estabelecimentos', description: 'Regras de contratação e uso do Fidelize para estabelecimentos.' };

export default function TermosEstabelecimentoPage() {
  return (
    <LegalPage title="Termos de Uso para Estabelecimentos">
      <p>
        Este documento vale para o <strong>estabelecimento que contrata</strong> o Fidelize (restaurante, loja, salão, clínica ou outro negócio), seus donos e equipes. O Fidelize é operado por {operatorLine()}.
        Ao criar a conta e contratar o plano, você declara que leu e concorda com estes Termos e com a <Link href="/privacidade" className="link-inline">Política de Privacidade</Link>.
        Quem apenas ganha pontos como cliente deve ler os <Link href="/termos/cliente" className="link-inline">Termos de Uso do Cliente</Link>.
      </p>

      <h2>1. O que você contrata</h2>
      <p>
        Uma plataforma para criar e operar o clube de pontos do seu negócio: lançamento de pontos no caixa (por QR Code ou direto pelo CPF do cliente), prêmios e campanhas, relatórios, agenda e reservas, e a vitrine de lugares do app.
        O Fidelize fornece a tecnologia; o programa (regras, prêmios, campanhas e atendimento) é seu.
      </p>

      <h2>2. Quem pode contratar</h2>
      <p>Pessoas jurídicas ou profissionais autônomos com poderes para contratar em nome do negócio. Você é responsável por manter os dados da conta verdadeiros e por quem da sua equipe usa o painel.</p>

      <h2>3. Assinatura, preço e pagamento</h2>
      <ul>
        <li>O plano é mensal, por assinatura recorrente, no valor exibido na contratação (hoje {PLAN_PRICE} por mês), sem taxa de adesão e sem fidelidade. Na primeira contratação, o primeiro mês sai por {FIRST_MONTH_PRICE} e a cobrança de {PLAN_PRICE} começa no segundo mês.</li>
        <li>A cobrança é feita pelo Stripe, processador de pagamentos. O Fidelize não armazena os dados completos do seu cartão.</li>
        <li>Reajustes de preço serão comunicados com pelo menos 30 dias de antecedência, e você poderá cancelar antes de passarem a valer.</li>
        <li>Se o pagamento falhar, o acesso ao painel e às funções que dependem da assinatura pode ser suspenso até a regularização.</li>
      </ul>

      <h2>4. Cancelamento e reembolso</h2>
      <p>
        Você pode cancelar a qualquer momento, pelo painel (Regras → Minha conta → “Gerenciar assinatura e faturas”) ou pelo suporte, sem multa. O acesso continua até o fim do período já pago.
        Em regra, não há reembolso proporcional do período em curso, ressalvados os direitos garantidos por lei, como o de arrependimento em até 7 dias da contratação quando a legislação de defesa do consumidor se aplicar.
      </p>

      <h2>5. Suas responsabilidades com o programa de pontos</h2>
      <ul>
        <li><strong>Prêmios:</strong> o estabelecimento define o que cada compra rende, os prêmios e seus custos, limites e campanhas, e é responsável por comunicá-los com clareza e por <strong>entregar os prêmios resgatados</strong>. Mudanças nas regras devem respeitar os pontos já acumulados de boa-fé.</li>
        <li><strong>Lançamentos verdadeiros:</strong> lance pontos apenas de compras e ações reais. É proibido criar lançamentos falsos, inflar saldos ou burlar limites. Pontos lançados por erro ou fraude podem ser estornados.</li>
        <li><strong>Lançar pelo CPF:</strong> o CPF só pode ser digitado com o conhecimento do cliente e apenas para lançar os pontos dele. A consulta mostra o nome abreviado e tem limite de uso; é proibido tentar listar ou descobrir CPFs de terceiros.</li>
        <li><strong>Atendimento:</strong> dúvidas de clientes sobre prêmios, compras e agendamentos são resolvidas por você. O Fidelize não é parte da relação de consumo entre o cliente e o estabelecimento.</li>
      </ul>

      <h2>6. Dados dos seus clientes</h2>
      <p>
        Ao usar o Fidelize, você acessa dados de clientes que se relacionam com o seu negócio (nome, telefone, histórico de pontos e compras no seu estabelecimento). Use esses dados somente para operar o programa, atender o cliente e
        enviar comunicações permitidas, respeitando a LGPD. Você não pode vender, repassar ou usar esses dados para finalidades alheias ao programa. Os pedidos de titulares (acesso, correção, exclusão) são tratados conforme a
        <Link href="/privacidade" className="link-inline"> Política de Privacidade</Link>.
      </p>

      <h2>7. Campanhas do app e pontos compartilhados</h2>
      <ul>
        <li><strong>Campanhas do app:</strong> são propostas pelo Fidelize e você escolhe participar ou não. Ao participar, a campanha passa a valer no seu caixa nos dias e horários definidos, e você pode sair quando quiser.</li>
        <li><strong>Pontos compartilhados:</strong> se você ativar “pontos daqui valem em outros lugares”, seus pontos poderão ajudar a completar resgates em lugares que aceitam pontos de terceiros, com conversão pelo valor de cada ponto. Se você ativar “aceito pontos de outros lugares”, entregará os prêmios resgatados desse modo. O Fidelize não faz acerto financeiro entre estabelecimentos.</li>
      </ul>

      <h2>8. Uso adequado</h2>
      <p>É proibido: acessar contas de terceiros; automatizar o acesso (robôs, coleta em massa de dados); enviar conteúdo ilícito, ofensivo ou que viole direitos de terceiros; ou tentar comprometer a segurança do serviço.</p>

      <h2>9. Seu conteúdo</h2>
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
        Na medida permitida pela lei, o Fidelize não responde por prejuízos indiretos, lucros cessantes ou perda de oportunidades decorrentes do uso ou da indisponibilidade do serviço, nem por atos e omissões do estabelecimento perante seus clientes.
        Nossa responsabilidade total perante você fica limitada ao valor pago por você nos últimos 12 meses, salvo quando a lei dispuser de modo diferente.
      </p>

      <h2>12. Suspensão e encerramento</h2>
      <p>Podemos suspender ou encerrar contas que violem estes Termos, causem risco a outros usuários ou à plataforma, ou estejam envolvidas em fraude, avisando sempre que possível.</p>

      <h2>13. Alterações</h2>
      <p>Podemos atualizar estes Termos. Mudanças relevantes serão avisadas pelo painel ou por e-mail. Continuar usando o serviço depois do aviso significa concordar com a nova versão.</p>

      <h2>14. Lei aplicável e foro</h2>
      <p>Estes Termos seguem a lei brasileira. Fica eleito o foro da comarca do domicílio do Fidelize, ressalvado o foro do consumidor quando a lei o assegurar.</p>

      <h2>15. Contato</h2>
      <SupportContactLine />
    </LegalPage>
  );
}
