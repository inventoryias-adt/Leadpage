/**
 * Funções ainda não prontas ficam escondidas. O botão do Assistente ("em breve") só aparece com NEXT_PUBLIC_ASSISTANT=1:
 * não faz sentido prometer, na tela de quem paga, algo que ainda não existe.
 */
export const ASSISTANT_ON = process.env.NEXT_PUBLIC_ASSISTANT === '1';
