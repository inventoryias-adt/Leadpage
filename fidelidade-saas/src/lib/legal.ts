/** Versão vigente dos Termos de Uso e da Política de Privacidade. Gravada junto com o aceite de quem se cadastra; mude ao alterar os textos. */
export const TERMS_VERSION = '2026-10-14';
export const TERMS_UPDATED_LABEL = '14 de outubro de 2026';

/** Dois documentos: um para quem contrata o Fidelize (estabelecimento) e outro para quem ganha os pontos (cliente). */
export const TERMS_HREF = { estabelecimento: '/termos/estabelecimento', cliente: '/termos/cliente' } as const;
export const TERMS_TITLE = { estabelecimento: 'Termos de Uso para Estabelecimentos', cliente: 'Termos de Uso do Cliente' } as const;
export type TermsKind = keyof typeof TERMS_HREF;

export const TERMS_REQUIRED_MESSAGE = 'Para continuar, aceite os Termos de Uso e a Política de Privacidade.';

/** O formulário de cadastro tem a caixa "Li e concordo" (name="acceptTerms"). */
export const termsAccepted = (formData: FormData) => formData.get('acceptTerms') === 'on';

/** Dados a gravar junto com o cadastro para provar quando e qual versão foi aceita. */
export const termsRecord = () => ({ termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION });
