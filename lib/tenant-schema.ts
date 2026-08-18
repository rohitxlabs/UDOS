import { readFileSync } from "node:fs";
import path from "node:path";
import { modelsForModules } from "@/lib/module-models";

// Deliberately not "server-only": this is a pure schema transform with no
// secrets in it, and keeping it importable outside Next lets the module
// combinations be tested directly against `prisma validate`.
//
// Builds a college-specific Prisma schema containing only the models its
// purchased modules need, by reading the one real tenant schema rather than
// keeping a second copy of the model definitions in sync by hand.
//
// The dependency rule that makes the output valid: a relation field that
// carries `@relation(fields: [...])` owns a foreign key, so its target table
// MUST exist. Every other model-typed field is a back-reference and can be
// dropped when the other side was not selected. Following only the
// foreign-key direction is what keeps the closure minimal — otherwise
// including Student would drag in Attendance, Marks, Fees and everything
// else that points back at it.

export const TENANT_SCHEMA_PATH = path.join(process.cwd(), "prisma", "tenant", "schema.prisma");

type Field = {
  raw: string;
  name: string;
  type: string; // base type, list/optional markers stripped
  isRelationOwner: boolean; // carries @relation(fields: [...])
  fkFields: string[]; // the scalar columns backing that relation
};

type Block = { kind: "model" | "enum"; name: string; header: string; body: string };

function splitBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const re = /^(model|enum)\s+(\w+)\s*\{$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const start = match.index;
    // Blocks are never nested in Prisma, so the next line that is exactly
    // "}" closes this one.
    const close = source.indexOf("\n}", start);
    const end = close === -1 ? source.length : close + 2;
    blocks.push({
      kind: match[1] as "model" | "enum",
      name: match[2],
      header: match[0],
      body: source.slice(source.indexOf("\n", start) + 1, close === -1 ? source.length : close),
    });
    re.lastIndex = end;
  }
  return blocks;
}

function parseFields(body: string): Field[] {
  const fields: Field[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
    const m = /^(\w+)\s+([\w]+)(\[\])?(\?)?(.*)$/.exec(line);
    if (!m) continue;
    const rest = m[5] ?? "";
    const relFields = /@relation\([^)]*fields:\s*\[([^\]]*)\]/.exec(rest);
    fields.push({
      raw,
      name: m[1],
      type: m[2],
      isRelationOwner: Boolean(relFields),
      fkFields: relFields ? relFields[1].split(",").map((s) => s.trim()).filter(Boolean) : [],
    });
  }
  return fields;
}

export type SchemaPlan = {
  models: string[];
  enums: string[];
  /** Models pulled in purely to satisfy a foreign key, not directly selected. */
  pulledIn: string[];
};

export type BuiltSchema = SchemaPlan & { schema: string };

export function buildTenantSchema(moduleKeys: string[], source?: string): BuiltSchema {
  const text = source ?? readFileSync(TENANT_SCHEMA_PATH, "utf8");
  const blocks = splitBlocks(text);
  const modelBlocks = new Map(blocks.filter((b) => b.kind === "model").map((b) => [b.name, b]));
  const enumBlocks = new Map(blocks.filter((b) => b.kind === "enum").map((b) => [b.name, b]));
  const fieldsOf = new Map([...modelBlocks].map(([name, b]) => [name, parseFields(b.body)]));

  const seeds = modelsForModules(moduleKeys).filter((m) => modelBlocks.has(m));

  // Transitive closure over foreign-key-owning relations only.
  const included = new Set<string>();
  const queue = [...seeds];
  while (queue.length) {
    const name = queue.shift()!;
    if (included.has(name)) continue;
    included.add(name);
    for (const field of fieldsOf.get(name) ?? []) {
      if (field.isRelationOwner && modelBlocks.has(field.type) && !included.has(field.type)) {
        queue.push(field.type);
      }
    }
  }

  const usedEnums = new Set<string>();
  const rendered: string[] = [];

  for (const name of [...modelBlocks.keys()].filter((n) => included.has(n))) {
    const fields = fieldsOf.get(name) ?? [];

    // Fields pointing at a model that was not selected, plus the scalar
    // columns that backed those relations.
    const droppedFields = new Set<string>();
    for (const field of fields) {
      if (modelBlocks.has(field.type) && !included.has(field.type)) {
        droppedFields.add(field.name);
        for (const fk of field.fkFields) droppedFields.add(fk);
      }
    }

    const keptLines: string[] = [];
    for (const raw of modelBlocks.get(name)!.body.split("\n")) {
      const line = raw.trim();
      if (!line) {
        keptLines.push(raw);
        continue;
      }
      if (line.startsWith("@@")) {
        // A block attribute naming a dropped column would no longer resolve.
        const referenced = /\[([^\]]*)\]/.exec(line)?.[1]?.split(",").map((s) => s.trim().split("(")[0]) ?? [];
        if (referenced.some((r) => droppedFields.has(r))) continue;
        keptLines.push(raw);
        continue;
      }
      const fieldName = /^(\w+)\s+/.exec(line)?.[1];
      if (fieldName && droppedFields.has(fieldName)) continue;
      if (fieldName) {
        const type = /^\w+\s+(\w+)/.exec(line)?.[1];
        if (type && enumBlocks.has(type)) usedEnums.add(type);
      }
      keptLines.push(raw);
    }

    rendered.push(`model ${name} {\n${keptLines.join("\n").replace(/\n+$/, "")}\n}`);
  }

  // No `generator` block and no datasource `url`: this schema exists only to
  // create tables. Prisma 7 takes the connection URL from prisma.config.ts
  // (see renderTenantPrismaConfig), and the application talks to every
  // college through the one client generated from the full schema — a
  // per-college client would be pointless duplication.
  const header = `// GENERATED — do not edit.
// A college-specific subset of prisma/tenant/schema.prisma, built from the
// modules that college was granted. Regenerated on every initialization.
//
// Modules: ${moduleKeys.length ? [...moduleKeys].sort().join(", ") : "(none)"}

datasource db {
  provider = "postgresql"
}
`;

  const enumsOut = [...enumBlocks.keys()]
    .filter((e) => usedEnums.has(e))
    .map((e) => `enum ${e} {\n${enumBlocks.get(e)!.body.replace(/\n+$/, "")}\n}`);

  return {
    models: [...included],
    enums: [...usedEnums],
    pulledIn: [...included].filter((m) => !seeds.includes(m)),
    schema: [header, ...enumsOut, ...rendered].join("\n\n") + "\n",
  };
}

// The config file Prisma 7 reads the target connection string from. Written
// next to the generated schema so the CLI is pointed at the college's own
// database and never at the master one.
export function renderTenantPrismaConfig(): string {
  // No dotenv import: the initialization service passes COLLEGE_DATABASE_URL
  // straight into the CLI's environment, and this file is written inside the
  // project tree so that `prisma/config` resolves.
  return `import { defineConfig } from "prisma/config";

// GENERATED — do not edit.
export default defineConfig({
  schema: "schema.prisma",
  datasource: {
    url: process.env["COLLEGE_DATABASE_URL"],
  },
});
`;
}
