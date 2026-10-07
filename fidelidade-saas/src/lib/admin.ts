import 'server-only';
import { prisma } from './db';

export { adminPasswordIssue, hashInviteToken, newInvite, tempPassword } from './admin-pure';

/** Registra uma ação da administração. */
export async function logAdmin(
  admin: { id: string; email: string },
  action: string,
  detail: string,
  restaurant?: { id: string; name: string },
) {
  await prisma.adminLog.create({
    data: { adminId: admin.id, adminEmail: admin.email, action, detail, restaurantId: restaurant?.id ?? null, restaurantName: restaurant?.name ?? null },
  });
}
