import "dotenv/config";
import { PrismaClient as PlatformPrismaClient } from "../app/generated/prisma/client";
import { PrismaClient as CollegePrismaClient, type PermissionAction } from "../app/generated/college-prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { GATED_MODULES, MODULE_LABELS, MODULE_DEPENDENCIES, moduleWithPrerequisites, type Module } from "../lib/permissions";
import { COLLEGE_ID, COLLEGE_ADMIN_ROLE, FULL_ACCESS } from "../lib/college";

// Deployment bootstrap. One deployment serves one college, so everything that
// used to be entered through an onboarding form is configuration instead:
// this reads the environment, writes both databases, and leaves the
// deployment ready to hand over.
//
// Every step is an upsert. Re-running this against a live deployment is safe
// and is the intended way to apply a changed module list or a renamed
// college — it never touches the college's operational data.
//
//   npm run db:setup
//
// Required:
//   PLATFORM_DATABASE_URL   control-plane database (this file's config side)
//   COLLEGE_DATABASE_URL    the college's ERP database
//   COLLEGE_NAME            e.g. "ABC College"
//   COLLEGE_CODE            e.g. "ABC001"  (unique, used as the college's key)
//
// Optional (sensible defaults, printed on first run):
//   ENABLED_MODULES         comma-separated module keys, or "all". Default: all
//   SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD / SUPER_ADMIN_NAME
//   COLLEGE_ADMIN_NAME / COLLEGE_ADMIN_USERNAME / COLLEGE_ADMIN_PASSWORD
//   COLLEGE_EMAIL / COLLEGE_PHONE / COLLEGE_ADDRESS / COLLEGE_WEBSITE

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required — set it in the environment before seeding this deployment.`);
  return value;
}

function optional(name: string): string | null {
  return process.env[name]?.trim() || null;
}

// Which modules this college is granted at deploy time. "all" (the default)
// grants the whole catalog; a list grants exactly those plus whatever they
// cannot function without, because handing over Attendance with no Students
// behind it produces a screen that cannot be used.
function resolveEnabledModules(): Module[] {
  const raw = process.env.ENABLED_MODULES?.trim();
  if (!raw || raw.toLowerCase() === "all") return [...GATED_MODULES];

  const requested = raw.split(",").map((k) => k.trim()).filter(Boolean);
  const unknown = requested.filter((k) => !GATED_MODULES.includes(k as Module));
  if (unknown.length > 0) {
    throw new Error(
      `ENABLED_MODULES contains unknown module keys: ${unknown.join(", ")}.\nValid keys: ${GATED_MODULES.join(", ")}`
    );
  }

  const closure = new Set<Module>();
  for (const key of requested) for (const dep of moduleWithPrerequisites(key as Module)) closure.add(dep);
  return [...closure];
}

// Built inside main() rather than at module scope so a missing or malformed
// connection string surfaces as the one-line message below, not as a stack
// trace out of an import that never got the chance to be handled.
let platformDb: PlatformPrismaClient | undefined;
let collegeDb: CollegePrismaClient | undefined;

async function main() {
  const enabled = resolveEnabledModules();

  const platformUrl = required("PLATFORM_DATABASE_URL");
  const collegeUrl = required("COLLEGE_DATABASE_URL");
  // Pointing both at one database would let the college's own tables and the
  // switches that govern them share a namespace — and a name collision there
  // is a security bug, not a migration error.
  if (platformUrl === collegeUrl) {
    throw new Error("PLATFORM_DATABASE_URL and COLLEGE_DATABASE_URL must be two different databases.");
  }

  // Assigned to the module-scoped bindings, not shadowing them, so the
  // disconnect handler below can still reach them if a later step throws.
  platformDb = new PlatformPrismaClient({ adapter: new PrismaPg({ connectionString: platformUrl }) });
  collegeDb = new CollegePrismaClient({ adapter: new PrismaPg({ connectionString: collegeUrl }) });

  // ── 1. The college this deployment serves ──────────────────────────────
  const college = await platformDb.college.upsert({
    where: { id: COLLEGE_ID },
    update: {
      name: required("COLLEGE_NAME"),
      code: required("COLLEGE_CODE"),
      email: optional("COLLEGE_EMAIL"),
      phone: optional("COLLEGE_PHONE"),
      address: optional("COLLEGE_ADDRESS"),
      website: optional("COLLEGE_WEBSITE"),
    },
    create: {
      id: COLLEGE_ID,
      name: required("COLLEGE_NAME"),
      code: required("COLLEGE_CODE"),
      email: optional("COLLEGE_EMAIL"),
      phone: optional("COLLEGE_PHONE"),
      address: optional("COLLEGE_ADDRESS"),
      website: optional("COLLEGE_WEBSITE"),
    },
  });
  console.log(`College: ${college.name} (${college.code})`);

  // ── 2. Platform Super Admin ────────────────────────────────────────────
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME?.trim() || "superadmin";
  const superAdminName = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";
  const envSuperAdminPassword = process.env.SUPER_ADMIN_PASSWORD?.trim();

  // Whether this account already exists decides what gets printed at the end.
  // Checked up front rather than inferred from the upsert, because an upsert
  // cannot tell the caller which branch it took — and printing a freshly
  // generated password for an account that kept its old one hands over a
  // credential that does not work.
  const existingSuperAdmin = await platformDb.platformUser.findUnique({ where: { username: superAdminUsername } });
  const newSuperAdminPassword = existingSuperAdmin ? null : envSuperAdminPassword ?? randomPassword();

  const superAdmin = existingSuperAdmin
    // An established Super Admin keeps their password: re-running the seed to
    // change the module list must never silently reset the platform owner's
    // own credentials out from under them.
    ? await platformDb.platformUser.update({
        where: { id: existingSuperAdmin.id },
        data: { name: superAdminName, isActive: true },
      })
    : await platformDb.platformUser.create({
        data: {
          username: superAdminUsername,
          name: superAdminName,
          platformRole: "SUPER_ADMIN",
          passwordHash: await bcrypt.hash(newSuperAdminPassword!, 12),
          // A password generated here, or supplied through an env file, has
          // to be changed at first sign-in.
          mustChangePassword: true,
          isActive: true,
        },
      });

  // ── 3. Module catalog, mirrored from lib/permissions.ts ────────────────
  // "users"/"roles"/"settings"/"auditLogs" are core college self-admin, not
  // grantable modules — remove any stale catalog rows for them.
  await platformDb.module.deleteMany({ where: { key: { in: ["users", "roles", "settings", "auditLogs"] } } });

  for (const key of GATED_MODULES) {
    await platformDb.module.upsert({
      where: { key },
      update: { name: MODULE_LABELS[key] },
      create: { key, name: MODULE_LABELS[key] },
    });
  }

  const byKey = new Map((await platformDb.module.findMany()).map((m) => [m.key, m.id]));

  // Dependencies mirrored from the single declaration in lib/permissions.ts,
  // so the database and the application can never disagree about what needs
  // what.
  await platformDb.moduleDependency.deleteMany({});
  let edges = 0;
  for (const [moduleKey, deps] of Object.entries(MODULE_DEPENDENCIES)) {
    const moduleId = byKey.get(moduleKey);
    if (!moduleId) continue;
    for (const dep of deps ?? []) {
      const dependsOnId = byKey.get(dep);
      if (!dependsOnId) continue;
      await platformDb.moduleDependency.create({ data: { moduleId, dependsOnId } });
      edges++;
    }
  }
  console.log(`Module catalog: ${GATED_MODULES.length} modules, ${edges} dependency edges`);

  // ── 4. Grant this college its modules (Layer 1) ────────────────────────
  // ENABLED_MODULES decides the *initial* grant only. Once a module has a
  // row, the Super Admin's toggles on /platform are authoritative and this
  // leaves it alone — otherwise a redeploy carrying a stale env value would
  // silently revoke a module the college had been given and is using, which
  // is exactly the kind of surprise a deployment must not spring on anyone.
  //
  // To change grants after the first seed, use the platform College page.
  const enabledSet = new Set<string>(enabled);
  for (const key of GATED_MODULES) {
    const moduleId = byKey.get(key);
    if (!moduleId) continue;
    const grant = enabledSet.has(key);
    await platformDb.moduleAccess.upsert({
      where: { moduleId },
      update: {},
      create: { moduleId, enabled: grant, enabledAt: grant ? new Date() : null, enabledById: grant ? superAdmin.id : null },
    });
  }

  // What the college actually holds now — which is the env list on a first
  // run, and whatever the Super Admin has since set on a re-run.
  const grantedKeys = (
    await platformDb.moduleAccess.findMany({ where: { enabled: true }, include: { module: { select: { key: true } } } })
  ).map((row) => row.module.key);
  console.log(`Modules granted: ${grantedKeys.length} of ${GATED_MODULES.length} — ${[...grantedKeys].sort().join(", ")}`);

  // ── 5. The college's own admin role and login (Layer 2) ────────────────
  const adminRole = await collegeDb.role.upsert({
    where: { name: COLLEGE_ADMIN_ROLE },
    update: { isSystem: true },
    create: { name: COLLEGE_ADMIN_ROLE, isSystem: true },
  });

  // Full access to every granted module. Only this one system role is set up
  // by the platform — every other role, and who holds it, is the College
  // Admin's decision.
  await collegeDb.rolePermission.createMany({
    data: grantedKeys.flatMap((moduleKey) =>
      FULL_ACCESS.map((action) => ({ roleId: adminRole.id, moduleKey, action: action as PermissionAction }))
    ),
    skipDuplicates: true,
  });

  await collegeDb.settings.upsert({ where: { id: "settings" }, update: {}, create: { id: "settings" } });

  const collegeAdminUsername = process.env.COLLEGE_ADMIN_USERNAME?.trim() || "admin";
  const existingAdmin = await collegeDb.user.findUnique({ where: { username: collegeAdminUsername } });
  const envCollegeAdminPassword = process.env.COLLEGE_ADMIN_PASSWORD?.trim();
  const collegeAdminPassword = envCollegeAdminPassword || randomPassword();

  if (existingAdmin) {
    // Same rule as the Super Admin: an established login keeps its password.
    // Use "Issue new admin password" on the platform College page to reset it.
    await collegeDb.user.update({
      where: { id: existingAdmin.id },
      data: { name: process.env.COLLEGE_ADMIN_NAME?.trim() || existingAdmin.name, roleId: adminRole.id, isActive: true },
    });
  } else {
    await collegeDb.user.create({
      data: {
        username: collegeAdminUsername,
        name: process.env.COLLEGE_ADMIN_NAME?.trim() || "College Admin",
        email: optional("COLLEGE_ADMIN_EMAIL"),
        roleId: adminRole.id,
        passwordHash: await bcrypt.hash(collegeAdminPassword, 12),
        mustChangePassword: true,
        // The first account in the college database has no creator: the
        // Super Admin who set this deployment up has no record in here.
        createdById: null,
      },
    });
  }

  console.log("\n─── Sign-in ─────────────────────────────────────────────");
  console.log(`Super Admin    ${superAdmin.username}`);
  if (!newSuperAdminPassword) console.log(`               (unchanged — existing account kept its password)`);
  else if (envSuperAdminPassword) console.log(`               (SUPER_ADMIN_PASSWORD from the environment)`);
  else console.log(`               ${newSuperAdminPassword}   (generated — shown once)`);
  console.log(`College Admin  ${collegeAdminUsername}`);
  if (existingAdmin) console.log(`               (unchanged — existing account kept its password)`);
  else if (envCollegeAdminPassword) console.log(`               (COLLEGE_ADMIN_PASSWORD from the environment)`);
  else console.log(`               ${collegeAdminPassword}   (generated — shown once)`);
  console.log("─────────────────────────────────────────────────────────");
  console.log("Newly created accounts must change their password at first sign-in.\n");
}

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function disconnect() {
  await Promise.all([platformDb?.$disconnect(), collegeDb?.$disconnect()]);
}

main()
  .then(disconnect)
  .catch(async (e) => {
    console.error(`\nSeeding failed: ${e instanceof Error ? e.message : e}\n`);
    await disconnect();
    process.exit(1);
  });
