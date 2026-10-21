// Roteiros dos vídeos: texto de abertura, legendas ligadas aos marcadores da gravação e fechamento.
export const OUTRO = { lines: 'Fidelidade que <em>cabe no celular</em>.', sub: 'Plano único de R$ 69,90 por mês, sem taxa de adesão', cta: 'Link na bio', handle: '@usefidelize' };

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
    intro: { lines: 'Lançar os pontos leva <em>10 segundos</em>', sub: 'Só o CPF do cliente', seconds: 2.6 },
    captions: [
      { at: 'caixa', title: 'Digite o <em>valor</em> da conta', sub: 'Os pontos são calculados sozinhos' },
      { at: 'cpf', title: 'Informe o <em>CPF</em> do cliente', sub: 'A conta dele é encontrada na hora' },
      { at: 'interacao', title: 'Some <em>pontos extras</em>', sub: 'Foto no Instagram, avaliação no Google...' },
      { at: 'lancado', title: 'Pontos <em>lançados</em>', sub: 'O cliente recebe um aviso no app' },
      { at: 'saldo-novo', title: 'O saldo dele <em>sobe</em> na hora', sub: '' },
      { at: 'premios', title: 'E já dá pra trocar por <em>prêmio</em>', sub: 'Cada visita aproxima a próxima' },
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
      { at: 'dono', title: 'Aparece na <em>sua agenda</em>', sub: 'Confirmar, remarcar, lançar pontos' },
    ],
  },
};
