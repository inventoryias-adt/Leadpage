/**
 * Cria (ou renova) o convite de um administrador e imprime o link para ele definir a senha.
 *   npm run admin:invite -- email@dominio.com "Nome da pessoa"
 * Usa DATABASE_URL do ambiente. O link vale 48 horas e só funciona uma vez.
 */
import { PrismaClient } from '@prisma/client';
import { newInvite } from '../src/lib/admin-pure';

async function main() {
  const [emailArg, ...nameParts] = process.argv.slice(2);
  const email = (emailArg ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Uso: npm run admin:invite -- email@dominio.com "Nome"');
    process.exit(1);
  }
  const name = nameParts.join(' ').trim() || email.split('@')[0];
  const prisma = new PrismaClient();
  try {
    const { token, tokenHash, expiresAt } = newInvite();
    await prisma.adminUser.upsert({
      where: { email },
      create: { email, name, inviteTokenHash: tokenHash, inviteExpiresAt: expiresAt },
      update: { inviteTokenHash: tokenHash, inviteExpiresAt: expiresAt, active: true },
    });
    const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    console.log(`\nConvite para ${email} (vale até ${expiresAt.toLocaleString('pt-BR')}):\n${base}/admin/convite/${token}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
