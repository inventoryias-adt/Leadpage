import type { Instrumentation } from 'next';

/** Toda falha não tratada no servidor (página, ação ou rota) vira um registro estruturado e, se configurado, um alerta. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as { message?: string; digest?: string; stack?: string };
  const { alertError } = await import('./lib/log');
  await alertError('erro_no_servidor', {
    mensagem: e.message,
    digest: e.digest,
    caminho: request.path,
    metodo: request.method,
    rota: context.routePath,
    tipo: context.routeType,
    pilha: e.stack?.split('\n').slice(0, 6).join(' | '),
  });
};
