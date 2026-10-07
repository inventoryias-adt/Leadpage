import { InviteForm } from '@/components/AdminForms';
import { Brand } from '@/components/Brand';
import { hashInviteToken } from '@/lib/admin';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Convite' };
export const dynamic = 'force-dynamic';

export default async function Convite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = await prisma.adminUser.findUnique({ where: { inviteTokenHash: hashInviteToken(token) } });
  const valid = !!admin && admin.active && !!admin.inviteExpiresAt && admin.inviteExpiresAt > new Date();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center"><Brand href="/" /></div>
      <div className="glass-panel p-6 sm:p-8">
        <h1 className="mb-4 text-2xl font-semibold text-primary">Convite de administrador</h1>
        {valid ? (
          <InviteForm token={token} name={admin.name} />
        ) : (
          <p className="glass-error" role="alert">Este convite não é mais válido (já foi usado ou expirou). Peça um novo.</p>
        )}
      </div>
    </main>
  );
}
