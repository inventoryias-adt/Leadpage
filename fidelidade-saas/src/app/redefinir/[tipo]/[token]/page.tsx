import Link from 'next/link';
import { ResetPasswordForm } from '@/components/AuthForms';
import { prisma } from '@/lib/db';
import { hashResetToken, looksLikeToken, segmentKind } from '@/lib/password-reset';

export const metadata = { title: 'Nova senha', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Ver a página não gasta o link: ele só é consumido ao salvar a senha nova. */
export default async function RedefinirSenha({ params }: { params: Promise<{ tipo: string; token: string }> }) {
  const { tipo, token } = await params;
  const kind = segmentKind(tipo);
  const valid = !!kind && looksLikeToken(token) && !!(await prisma.passwordReset.findFirst({ where: { tokenHash: hashResetToken(token), kind, usedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } }));
  const loginHref = kind === 'restaurant' ? '/login' : '/entrar';
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-panel w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-bold text-primary">Criar senha nova</h1>
        {valid ? (
          <>
            <p className="mb-6 text-sm text-slate-500">Escolha uma senha com pelo menos 8 caracteres.</p>
            <ResetPasswordForm tipo={tipo} token={token} loginHref={loginHref} />
          </>
        ) : (
          <div className="space-y-4">
            <p className="glass-error">Este link é inválido, já foi usado ou venceu. Peça um novo.</p>
            <Link href={loginHref} className="glass-button">Voltar para entrar</Link>
          </div>
        )}
      </div>
    </main>
  );
}
