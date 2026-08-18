import "server-only";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "pg";
import { prisma as platformDb } from "@/lib/prisma";
import { buildTenantSchema, renderTenantPrismaConfig } from "@/lib/tenant-schema";
import { GATED_MODULES, moduleWithPrerequisites, type Module } from "@/lib/permissions";

const execFileAsync = promisify(execFile);

// Applying a schema to a hosted Postgres takes ~20s; a generous ceiling so a
// slow provider fails with a clear message instead of hanging forever.
const INIT_TIMEOUT_MS = 3 * 60 * 1000;

// Generated schemas live inside the project so `prisma/config` resolves from
// them, and are git-ignored — they are build artefacts, regenerated on every
// initialization, never a source of truth.
const GENERATED_ROOT = path.join(process.cwd(), ".prisma-college");

// Strips ANSI colour codes out of CLI output before it is stored as an error.
const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

export type InitResult =
  | { ok: true; models: string[]; tables: string[]; pulledIn: string[] }
  | { ok: false; error: string };

// The dedicated service that turns "a college bought these modules and gave
// us this Neon URL" into a working, correctly-shaped database.
//
// Safe to retry by design: it never drops or resets anything, applies the
// schema additively, and converges on the target shape whether the database
// is empty, partially built, or already live with data. Enabling a module
// later simply re-runs it with a wider model set, which adds the new tables
// and leaves existing ones — and their data — untouched.
export async function initializeCollegeDatabase(params: {
  collegeId: string;
  databaseUrl: string;
  schemaName: string;
  moduleKeys: string[];
}): Promise<InitResult> {
  const { collegeId, databaseUrl, schemaName, moduleKeys } = params;

  const fail = async (error: string): Promise<InitResult> => {
    await platformDb.college.update({
      where: { id: collegeId },
      data: { dbStatus: "FAILED", dbError: error.slice(0, 1000) },
    });
    return { ok: false, error };
  };

  // 2. Validate the modules before anything is written. An unknown key would
  //    otherwise silently contribute no models and quietly produce a database
  //    missing the tables that module needs.
  const unknown = moduleKeys.filter((k) => !GATED_MODULES.includes(k as Module));
  if (unknown.length > 0) return fail(`Unknown module(s): ${unknown.join(", ")}`);

  // Module prerequisites decide the real model set: Attendance without
  // Students would generate a schema whose foreign keys have nowhere to point.
  const effectiveModules = [...new Set(moduleKeys.flatMap((k) => moduleWithPrerequisites(k as Module)))];

  await platformDb.college.update({
    where: { id: collegeId },
    data: { dbStatus: "INITIALIZING", dbError: null },
  });

  // 1. Validate the credentials, and make sure the college's namespace exists
  //    before Prisma is pointed at it.
  try {
    const probe = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15_000 });
    await probe.connect();
    await probe.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await probe.end();
  } catch (err) {
    return fail(`Could not connect to the college database: ${(err as Error).message}`);
  }

  // 3-5. Resolve the models this college needs, with their foreign-key
  //      dependencies, and render a schema containing only those.
  let built;
  try {
    built = buildTenantSchema(effectiveModules);
  } catch (err) {
    return fail(`Could not build the college schema: ${(err as Error).message}`);
  }

  // 6. Point Prisma at *this college's* database — never the master one.
  const dir = path.join(GENERATED_ROOT, collegeId);
  const targetUrl = withSchema(databaseUrl, schemaName);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "schema.prisma"), built.schema);
    writeFileSync(path.join(dir, "prisma.config.ts"), renderTenantPrismaConfig());
  } catch (err) {
    return fail(`Could not write the generated schema: ${(err as Error).message}`);
  }

  // 7. Apply it. `db push` without --force-reset and without
  //    --accept-data-loss: it refuses rather than destroys, which is the
  //    behaviour we want against a database that may already be live.
  try {
    await execFileAsync(
      "npx",
      // No --skip-generate: Prisma 7 dropped that flag, and the generated
      // schema deliberately has no generator block, so nothing is generated.
      ["prisma", "db", "push", "--config", path.join(dir, "prisma.config.ts")],
      {
        cwd: process.cwd(),
        env: { ...process.env, COLLEGE_DATABASE_URL: targetUrl },
        timeout: INIT_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const detail = (e.stderr || e.stdout || e.message || "").replace(ANSI, "").trim();
    return fail(`Schema apply failed: ${detail.slice(0, 900)}`);
  }

  // 8-9. Verify: connect independently and confirm every expected table is
  //      really there. A green exit code from the CLI is not evidence.
  let tables: string[];
  try {
    const verify = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15_000 });
    await verify.connect();
    const result = await verify.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
      [schemaName]
    );
    await verify.end();
    tables = result.rows.map((r: { table_name: string }) => r.table_name);
  } catch (err) {
    return fail(`Could not verify the college database: ${(err as Error).message}`);
  }

  const missing = built.models.filter((m) => !tables.includes(m));
  if (missing.length > 0) {
    return fail(`Initialization incomplete — missing table(s): ${missing.join(", ")}`);
  }

  // 10. Only now is it safe to call this database ready.
  await platformDb.college.update({
    where: { id: collegeId },
    data: {
      dbStatus: "READY",
      dbError: null,
      dbModels: built.models,
      dbInitializedAt: new Date(),
    },
  });

  // The generated schema has served its purpose; it is rebuilt from the real
  // schema on every run, so keeping it around only risks it being mistaken
  // for a source of truth.
  rmSync(dir, { recursive: true, force: true });

  return { ok: true, models: built.models, tables, pulledIn: built.pulledIn };
}

function withSchema(databaseUrl: string, schemaName: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schemaName);
  return url.toString();
}
