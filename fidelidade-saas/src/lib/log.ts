/**
 * Registro estruturado: uma linha JSON por evento, que a Vercel guarda e permite filtrar (`level`, `event`, `ctx`).
 * Se ALERT_WEBHOOK_URL estiver definida (Slack, Discord, Telegram via ponte…), erros também viram um aviso nesse endereço.
 */
type Level = 'info' | 'warn' | 'error';

export function log(level: Level, event: string, ctx: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...ctx });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Aviso fora do sistema quando algo grave acontece. Nunca derruba a requisição que o chamou. */
export async function alertError(event: string, ctx: Record<string, unknown> = {}) {
  log('error', event, ctx);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    const text = `Fidelize · ${event}\n${JSON.stringify(ctx).slice(0, 1500)}`;
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(4000) });
  } catch {
    /* o aviso é um extra: se falhar, o log acima já registrou */
  }
}
