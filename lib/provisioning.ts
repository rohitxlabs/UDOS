import "server-only";
import { hashPassword, generatePassword, usernameBase } from "@/lib/password";
import type { Prisma as CollegePrisma, PrismaClient as CollegePrismaClient } from "@/app/generated/college-prisma/client";

type CollegeDbLike = CollegePrismaClient | CollegePrisma.TransactionClient;

// Shared account-provisioning logic used anywhere a college login gets
// created by an admin rather than through self-registration (there is no
// self-registration).
//
// A username only has to be unique inside this one database now — there is no
// cross-college routing directory to keep in step, because there is no other
// college on this deployment to route to.
export async function createLoginAccount(
  db: CollegeDbLike,
  params: {
    name: string;
    roleId?: string | null;
    email?: string | null;
    phone?: string | null;
    customUsername?: string | null;
    customPassword?: string | null;
    // The college User creating this account. Null for the bootstrap College
    // Admin, which the deployment's seed creates before any college user
    // exists to be its creator.
    createdById: string | null;
  }
): Promise<{ userId: string; username: string; password: string } | { error: string }> {
  const isTaken = async (candidate: string) => Boolean(await db.user.findUnique({ where: { username: candidate } }));

  let username = params.customUsername?.trim();
  if (username) {
    if (await isTaken(username)) return { error: `Username "${username}" is already taken` };
  } else {
    const base = usernameBase(params.name);
    let candidate = "";
    let attempt = 0;
    do {
      const suffix = attempt === 0 ? String(Math.floor(100 + Math.random() * 900)) : String(Date.now()).slice(-6);
      candidate = `${base}.${suffix}`;
      attempt++;
    } while ((await isTaken(candidate)) && attempt < 5);
    if (await isTaken(candidate)) return { error: "Could not allocate a unique username — please try again" };
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
      roleId: params.roleId || null,
      passwordHash,
      mustChangePassword: true,
      createdById: params.createdById,
    },
  });

  return { userId: user.id, username, password };
}
