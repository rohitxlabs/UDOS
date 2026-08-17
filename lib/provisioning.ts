import "server-only";
import { prisma } from "@/lib/prisma";
import { hashPassword, generatePassword, usernameBase } from "@/lib/password";
import type { Prisma, Role } from "@/app/generated/prisma/client";

type Db = typeof prisma | Prisma.TransactionClient;

// Shared account-provisioning logic used by Users, Student Management and
// Faculty Management — anywhere a login gets created by an admin rather
// than through self-registration (there is no self-registration).
export async function createLoginAccount(
  db: Db,
  params: {
    name: string;
    role: Role;
    email?: string | null;
    phone?: string | null;
    customUsername?: string | null;
    customPassword?: string | null;
    createdById: string;
  }
): Promise<{ userId: string; username: string; password: string } | { error: string }> {
  let username = params.customUsername?.trim();
  if (username) {
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) return { error: `Username "${username}" is already taken` };
  } else {
    const base = usernameBase(params.name);
    let candidate = "";
    let attempt = 0;
    do {
      const suffix = attempt === 0 ? String(Math.floor(100 + Math.random() * 900)) : String(Date.now()).slice(-6);
      candidate = `${base}.${suffix}`;
      attempt++;
    } while ((await db.user.findUnique({ where: { username: candidate } })) && attempt < 5);
    username = candidate;
  }

  const password = params.customPassword?.trim() || generatePassword();
  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      username,
      email: params.email || null,
      phone: params.phone || null,
      name: params.name,
      role: params.role,
      passwordHash,
      mustChangePassword: true,
      createdById: params.createdById,
    },
  });

  return { userId: user.id, username, password };
}
