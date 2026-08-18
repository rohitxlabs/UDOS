// Tests for the module -> Prisma model resolution that decides which tables
// a college's database gets. Run with:  npx tsx tests/tenant-schema.test.mts
//
// These assert the two properties the whole design rests on:
//   1. a college only gets the tables its modules need, and
//   2. the schema that produces is always valid — every foreign key it emits
//      has a table to point at.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { buildTenantSchema, renderTenantPrismaConfig } from "../lib/tenant-schema";
import { MODULE_MODELS, CORE_MODELS } from "../lib/module-models";
import { moduleWithPrerequisites, GATED_MODULES } from "../lib/permissions";

const SOURCE = readFileSync(path.join(process.cwd(), "prisma/tenant/schema.prisma"), "utf8");
const WORK = path.join(process.cwd(), ".prisma-college", "__test");

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}\n          ${(err as Error).message}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Expand a module selection the same way the initializer does. */
const expand = (mods: string[]) => [...new Set(mods.flatMap((m) => moduleWithPrerequisites(m as never)))];

/** Ask Prisma itself whether the generated schema is valid. */
function prismaValidates(name: string, schema: string): { ok: boolean; error?: string } {
  const dir = path.join(WORK, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "schema.prisma"), schema);
  writeFileSync(path.join(dir, "prisma.config.ts"), renderTenantPrismaConfig());
  try {
    execFileSync("npx", ["prisma", "validate", "--config", path.join(dir, "prisma.config.ts")], {
      stdio: "pipe",
      cwd: process.cwd(),
      env: { ...process.env, COLLEGE_DATABASE_URL: "postgresql://u:p@localhost:5432/x" },
    });
    return { ok: true };
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    const out = ((err.stderr?.toString() ?? "") + (err.stdout?.toString() ?? "")).replace(
      new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"),
      ""
    );
    return { ok: false, error: out.split("\n").filter((l) => /error/i.test(l)).slice(0, 3).join(" | ") };
  }
}

console.log("\nModule -> model resolution\n");

check("core models are always present, even with no modules", () => {
  const built = buildTenantSchema([], SOURCE);
  for (const model of CORE_MODELS) {
    assert(built.models.includes(model), `missing core model ${model}`);
  }
});

check("a college does NOT get tables for modules it did not buy", () => {
  const built = buildTenantSchema(expand(["students"]), SOURCE);
  for (const absent of ["LibraryBook", "LibraryTransaction", "Payment", "Receipt", "Marks", "AdmitCard"]) {
    assert(!built.models.includes(absent), `${absent} leaked into a students-only college`);
  }
});

check("attendance pulls in the models its foreign keys require", () => {
  const built = buildTenantSchema(expand(["attendance"]), SOURCE);
  for (const required of ["Attendance", "Student", "Subject", "Teacher"]) {
    assert(built.models.includes(required), `attendance is missing ${required}`);
  }
});

check("library pulls in Student but not unrelated modules", () => {
  const built = buildTenantSchema(expand(["library"]), SOURCE);
  assert(built.models.includes("LibraryBook"), "missing LibraryBook");
  assert(built.models.includes("LibraryTransaction"), "missing LibraryTransaction");
  assert(built.models.includes("Student"), "LibraryTransaction needs Student");
  assert(!built.models.includes("Payment"), "Payment leaked into a library college");
});

check("payments pulls in the fee chain it books against", () => {
  const built = buildTenantSchema(expand(["payments"]), SOURCE);
  for (const required of ["Payment", "Receipt", "StudentFee", "FeeStructure", "Student"]) {
    assert(built.models.includes(required), `payments is missing ${required}`);
  }
});

check("results pulls the whole examination chain", () => {
  const built = buildTenantSchema(expand(["results"]), SOURCE);
  for (const required of ["Result", "Marks", "ExamSubject", "Examination", "Student"]) {
    assert(built.models.includes(required), `results is missing ${required}`);
  }
});

check("selecting every module reproduces the full schema", () => {
  const built = buildTenantSchema(expand([...GATED_MODULES]), SOURCE);
  const allModels = [...SOURCE.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  const missing = allModels.filter((m) => !built.models.includes(m));
  assert(missing.length === 0, `full selection omitted: ${missing.join(", ")}`);
});

check("more modules never means fewer tables", () => {
  const small = buildTenantSchema(expand(["students"]), SOURCE).models;
  const large = buildTenantSchema(expand(["students", "attendance", "fees"]), SOURCE).models;
  const lost = small.filter((m) => !large.includes(m));
  assert(lost.length === 0, `widening the module set dropped: ${lost.join(", ")}`);
});

console.log("\nGenerated schema validity (via prisma validate)\n");

const combinations: [string, string[]][] = [
  ["core-only", []],
  ["students", ["students"]],
  ["attendance", ["attendance"]],
  ["fees-payments", ["payments"]],
  ["exam-chain", ["results", "admitCards"]],
  ["library", ["library"]],
  ["timetable", ["timetable"]],
  ["everything", [...GATED_MODULES]],
];

rmSync(WORK, { recursive: true, force: true });
for (const [name, mods] of combinations) {
  check(`${name} (${expand(mods).length} modules) generates a valid schema`, () => {
    const built = buildTenantSchema(expand(mods), SOURCE);
    const result = prismaValidates(name, built.schema);
    assert(result.ok, result.error ?? "prisma validate failed");
  });
}
rmSync(WORK, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
