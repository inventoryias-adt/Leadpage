'use client';

/** Última rede de proteção: falha no próprio layout. Não pode depender do CSS do app, então leva estilos próprios. */
export default function ErroGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3EC', fontFamily: 'system-ui, sans-serif', color: '#12241C', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Algo deu errado</h1>
          <p style={{ color: '#475569', margin: '0 0 16px' }}>Tente de novo. Se continuar, fale com o suporte{error.digest ? ` e informe o código ${error.digest}` : ''}.</p>
          <button onClick={reset} style={{ padding: '12px 24px', border: 0, borderRadius: 8, background: '#1E5B43', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Tentar de novo</button>
        </div>
      </body>
    </html>
  );
}
