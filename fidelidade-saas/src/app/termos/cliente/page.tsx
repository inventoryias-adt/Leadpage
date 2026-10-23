import Link from 'next/link';
import { LegalPage, SupportContactLine, operatorLine } from '@/components/LegalPage';

export const metadata = { title: 'Termos de Uso do Cliente', description: 'Regras de uso do Fidelize para quem acumula e troca pontos.' };

export default function TermosClientePage() {
  return (
    <LegalPage title="Termos de Uso do Cliente">
      <p>
        Este documento vale para <strong>você, cliente, que acumula e troca pontos</strong> nos lugares que participam do Fidelize. O app é operado por {operatorLine()}.
        Ao criar a sua conta ou usar o app, você declara que leu e concorda com estes Termos e com a <Link href="/privacidade" className="link-inline">Política de Privacidade</Link>.
        Se você é dono ou funcionário de um estabelecimento, leia os <Link href="/termos/estabelecimento" className="link-inline">Termos de Uso para Estabelecimentos</Link>.
      </p>

      <h2>1. O que é o Fidelize para você</h2>
      <p>
        Um clube de pontos: você ganha pontos quando compra nos lugares participantes e troca por prêmios, descontos e vantagens. Cada lugar cria o próprio programa; o Fidelize guarda os seus pontos
        de todos eles em um só app, mostra campanhas e ajuda a encontrar lugares perto de você.
      </p>

      <h2>2. Quem pode usar</h2>
      <p>Pessoas com 18 anos ou mais. Menores só podem usar com acompanhamento e autorização de um responsável.</p>

      <h2>3. Sua conta</h2>
      <ul>
        <li>Informe dados verdadeiros (nome, CPF e telefone) e mantenha-os atualizados. O CPF identifica a sua carteira e não pode ser usado por outra pessoa.</li>
        <li>A senha é pessoal: não a compartilhe. Você responde pelo que for feito com a sua conta. Se suspeitar de uso indevido, avise o suporte.</li>
        <li>Você pode pedir o encerramento da conta a qualquer momento pelo suporte.</li>
      </ul>

      <h2>4. Como você ganha pontos</h2>
      <ul>
        <li>Pelo <strong>QR Code</strong> ou link que o caixa gera na sua compra (uso único e com validade), ou quando o estabelecimento <strong>lança os pontos direto na sua conta pelo seu CPF</strong>, com o seu conhecimento.</li>
        <li>Por check-in no local, indicação de amigos, desafios e campanhas, quando o lugar oferecer.</li>
        <li>Pontos creditados por erro, fraude ou abuso poderão ser estornados.</li>
      </ul>

      <h2>5. O que são os pontos</h2>
      <ul>
        <li>Pontos são um benefício de fidelidade. <strong>Não são dinheiro</strong>, não podem ser sacados ou reembolsados e só valem conforme as regras do lugar em que foram ganhos.</li>
        <li>Cada estabelecimento define quanto cada compra rende, os prêmios, o custo em pontos, limites de resgate e campanhas, e pode alterar essas regras, avisando no app. Os pontos que você já tem são respeitados de boa-fé.</li>
        <li>O prêmio é do estabelecimento: ele o entrega e responde por ele. O Fidelize não vende os produtos e não é parte da compra. Dúvidas sobre o prêmio ou o atendimento devem ser resolvidas com o lugar.</li>
      </ul>

      <h2>6. Trocar pontos</h2>
      <p>
        Ao resgatar, o app gera um <strong>código</strong> que você mostra no balcão para retirar o prêmio, quando o lugar pede. Alguns prêmios combinam pontos e um valor em dinheiro pago no balcão.
        Os pontos saem da sua carteira na hora do resgate. Resgates retirados no balcão não podem ser desfeitos, salvo erro do lugar.
      </p>

      <h2>7. Pontos compartilhados entre lugares</h2>
      <p>
        Alguns lugares deixam os pontos ganhos neles serem usados em outros que aceitam pontos de terceiros. Nesse caso, o app converte pelo valor de cada ponto (um lugar que dá menos pontos por real tem pontos mais valiosos)
        e mostra antes de você confirmar quanto sairá de cada carteira. Só entra o que faltar para completar o resgate.
      </p>

      <h2>8. Agendamentos e reservas</h2>
      <p>
        Em lugares com agenda, você escolhe serviço, profissional e horário. Cancele pelo app dentro do prazo do lugar; pontos usados como desconto voltam ao cancelar. Você receberá um aviso pouco antes do horário perguntando se está tudo certo:
        se responder que não, o horário é liberado. Faltas sem aviso podem seguir as regras do estabelecimento.
      </p>

      <h2>9. Localização e endereços</h2>
      <p>
        Você escolhe se quer usar a localização do aparelho, marcar um ponto no mapa ou salvar endereços (Casa, Trabalho, Outro) para ver os lugares por perto e as distâncias. Endereços salvos ficam na sua conta e você pode apagá-los quando quiser.
      </p>

      <h2>10. Indicações, fotos e mensagens</h2>
      <p>
        Na aba Indicações você pode postar fotos de lugares onde tem carteira, com nota e comentário. Poste só fotos suas, do lugar ou do que você consumiu, sem expor outras pessoas sem permissão. Fotos e comentários ficam visíveis para os demais clientes do Fidelize e para o dono do lugar citado, junto com o seu primeiro nome e o seu @ do Instagram, se você o informar. É proibido postar conteúdo ofensivo, ilegal, enganoso ou que não seja do lugar citado. Qualquer cliente ou dono de lugar pode denunciar uma indicação; a administração pode escondê-la ou apagá-la, e você pode apagar as suas quando quiser. O Fidelize não importa nem lê o seu Instagram: o botão de compartilhar apenas abre o compartilhamento do seu aparelho. Nos lugares onde você tem carteira também dá para trocar mensagens com o estabelecimento pelo app; elas ficam visíveis só para você e para o lugar, devem ser respeitosas, e o lugar responde pelo que disser.
      </p>

      <h2>11. Uso adequado</h2>
      <p>É proibido: usar QR Codes ou códigos de terceiros; criar contas falsas ou duplicadas para ganhar vantagens; burlar limites; automatizar o acesso; ou tentar comprometer a segurança do serviço. O descumprimento pode levar à suspensão da conta e ao estorno de pontos.</p>

      <h2>12. Disponibilidade</h2>
      <p>Podem ocorrer interrupções por manutenção, falhas de terceiros ou causas fora do nosso controle. O suporte funciona por e-mail e WhatsApp, em horário comercial.</p>

      <h2>13. Limitação de responsabilidade</h2>
      <p>
        Na medida permitida pela lei, o Fidelize não responde por atos e omissões dos estabelecimentos (como não entregar um prêmio ou alterar suas regras), nem por prejuízos indiretos decorrentes do uso ou da indisponibilidade do app.
        Isso não afasta direitos que a lei do consumidor garante a você.
      </p>

      <h2>14. Alterações</h2>
      <p>Podemos atualizar estes Termos. Mudanças relevantes serão avisadas pelo app ou por e-mail. Continuar usando o app depois do aviso significa concordar com a nova versão.</p>

      <h2>15. Lei aplicável e foro</h2>
      <p>Estes Termos seguem a lei brasileira. Como você é consumidor, fica eleito o foro do seu domicílio.</p>

      <h2>16. Contato</h2>
      <SupportContactLine />
    </LegalPage>
  );
}
