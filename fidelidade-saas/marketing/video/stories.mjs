// Roteiros dos vídeos: texto de abertura, legendas ligadas aos marcadores da gravação e fechamento.
export const OUTRO = { lines: 'Fidelidade que <em>cabe no celular</em>.', price: 'R$ 39,90', priceNote: 'no primeiro mês', sub: 'Depois, R$ 69,90 por mês. Sem taxa de adesão e sem fidelidade.', cta: 'Link na bio', handle: '@usefidelize' };

export const stories = {
  cliente: {
    intro: { lines: 'Seu cliente <em>perdeu</em> o cartão de fidelidade?', sub: 'De novo?', seconds: 2.6 },
    captions: [
      { at: 'inicio', title: 'Os pontos ficam <em>no celular</em>', sub: 'Sem cartão de papel, sem carimbo' },
      { at: 'saldo', title: 'Ele vê quanto <em>falta</em> pro prêmio', sub: 'Tudo claro, na hora' },
      { at: 'premios', title: 'Escolhe o <em>prêmio</em>', sub: 'Quem define os prêmios é você' },
      { at: 'confirmar', title: 'Um toque pra <em>resgatar</em>', sub: '' },
      { at: 'cupom', title: 'Cupom na mão, é só <em>mostrar no balcão</em>', sub: 'Resgate feito, sem fila e sem papel' },
    ],
  },
  caixa: {
    intro: { lines: 'Lançar os pontos leva <em>10 segundos</em>', sub: 'Pelo CPF, pelo ID da conta ou por QR Code', seconds: 3 },
    captions: [
      { at: 'caixa', title: 'Digite o <em>valor</em> da conta', sub: 'Os pontos são calculados sozinhos' },
      { at: 'cpf', title: 'Informe o <em>CPF</em> do cliente', sub: 'Ou o ID da conta dele. Ela é encontrada na hora' },
      { at: 'interacao', title: 'Some <em>pontos extras</em>', sub: 'Foto no Instagram, avaliação no Google...' },
      { at: 'lancado', title: 'Pontos <em>lançados</em>', sub: 'O cliente recebe um aviso no app' },
      { at: 'saldo-novo', title: 'O saldo dele <em>sobe</em> na hora', sub: '' },
      { at: 'premios', title: 'E já dá pra trocar por <em>prêmio</em>', sub: 'Cada visita aproxima a próxima' },
      { at: 'qr-valor', title: 'Cliente <em>sem conta</em> ainda?', sub: 'Digite o valor e gere o QR Code' },
      { at: 'qr', title: 'Ele lê o <em>QR Code</em> e cria a conta', sub: 'Uso único, vale por 24 horas' },
    ],
  },
  agenda: {
    intro: { lines: 'O cliente marca sozinho. Você <em>só atende</em>.', sub: 'Agenda sem conflito', seconds: 2.8 },
    captions: [
      { at: 'servicos', title: 'O cliente escolhe o <em>serviço</em>', sub: 'Corte, barba, o que você oferecer' },
      { at: 'profissional', title: 'E o <em>profissional</em>', sub: 'Ou deixa em "qualquer um"' },
      { at: 'horario', title: 'Vê só os <em>horários livres</em>', sub: 'Sem conflito, sem marcação dupla' },
      { at: 'confirmar', title: 'Horário <em>reservado</em> por 5 minutos', sub: 'Enquanto ele confirma, ninguém pega' },
      { at: 'sucesso', title: 'Pronto: <em>agendado</em>', sub: 'Com calendário e como chegar' },
      { at: 'dono', title: 'Aparece na <em>sua agenda</em>', sub: 'Ao concluir o atendimento, os pontos entram sozinhos' },
    ],
  },
  checkin: {
    intro: { lines: 'Chegou? <em>Ganhou</em> ponto.', sub: 'Check-in no lugar, sem cartão e sem fila', seconds: 2.6 },
    captions: [
      { at: 'inicio', title: 'Cliente <em>passando</em> pela porta', sub: 'Abre o Fidelize no celular' },
      { at: 'lugares', title: 'Encontra o <em>lugar</em>', sub: 'Todos os lugares do clube, num só app' },
      { at: 'lugar', title: 'Cada lugar tem as suas <em>ações</em>', sub: 'Você escolhe quanto vale cada uma' },
      { at: 'acoes', title: 'Check-in dá <em>pontos extras</em>', sub: 'Só vale de dentro do estabelecimento' },
      { at: 'feito', title: 'Pontos <em>na hora</em>', sub: 'Uma vez por dia, por cliente' },
      { at: 'saldo', title: 'O saldo <em>sobe</em>', sub: 'Mais um motivo para voltar' },
    ],
  },
  aniversario: {
    intro: { lines: 'No aniversário, o cliente <em>ganha pontos</em>.', sub: 'E volta pra comemorar com você', seconds: 2.8 },
    captions: [
      { at: 'lugar', title: 'O cliente conta o <em>aniversário</em>', sub: 'Só dia e mês, sem ano' },
      { at: 'informar', title: 'Escolhe o <em>dia e o mês</em>', sub: 'Leva dois toques' },
      { at: 'salvo', title: 'Pronto: o app <em>lembra</em> do dia', sub: '' },
      { at: 'aviso', title: 'No dia, chega o <em>presente</em>', sub: 'Você escolhe quantos pontos dar' },
      { at: 'saldo', title: 'Pontos <em>na carteira</em>, sozinhos', sub: 'Um presente por ano, sem trabalho pra você' },
    ],
  },
  pedido: {
    intro: { lines: 'Cliente pede pelo app. <em>Você só entrega.</em>', sub: 'Pedido com retirada, sem taxa de entrega', seconds: 3 },
    captions: [
      { at: 'lugar', title: 'Pedido <em>direto</em> no app do lugar', sub: 'Sem intermediário' },
      { at: 'cardapio', title: 'O <em>cardápio</em> é seu', sub: 'Foto, preço e promoção do jeito que você quiser' },
      { at: 'sacola', title: 'Monta a <em>sacola</em>', sub: '' },
      { at: 'conferir', title: 'Total e <em>pontos</em> à vista', sub: 'Todo pedido retirado vira pontos' },
      { at: 'retirada', title: 'Retira e <em>paga no balcão</em>', sub: 'Com o tempo de preparo que você definir' },
      { at: 'codigo', title: 'Recebe o <em>código</em> do pedido', sub: 'É só mostrar na retirada' },
      { at: 'dono', title: 'Chega na <em>sua fila</em>', sub: 'Um painel simples, até no celular' },
      { at: 'preparando', title: 'Você marca <em>preparando</em>', sub: '' },
      { at: 'pronto', title: 'E <em>pronto para retirar</em>', sub: 'O cliente é avisado na hora' },
      { at: 'avisada', title: 'Aviso <em>no celular</em> dele', sub: 'Sem ligar, sem WhatsApp' },
    ],
  },
  espera: {
    intro: { lines: 'Agenda lotada? <em>Ninguém</em> vai embora.', sub: 'Lista de espera automática', seconds: 2.8 },
    captions: [
      { at: 'lotado', title: 'Dia <em>lotado</em>, e agora?', sub: 'O cliente não precisa desistir' },
      { at: 'faixa', title: 'Ele entra na <em>lista de espera</em>', sub: 'E escolhe a faixa do dia que serve pra ele' },
      { at: 'nafila', title: 'Pronto: <em>1º da fila</em>', sub: 'Sem ligar, sem mandar mensagem' },
      { at: 'aviso', title: 'Alguém cancelou? <em>Ele é avisado</em>', sub: 'Só quem pediu aquela faixa de horário' },
      { at: 'reservado', title: 'Horário <em>reservado</em> pra ele', sub: 'Cinco minutos pra confirmar, sem disputa' },
      { at: 'agendado', title: 'Horário <em>recuperado</em>', sub: 'Menos buraco na agenda, mais faturamento' },
    ],
  },
};
