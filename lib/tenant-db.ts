import "server-only";
import crypto from "node:crypto";
import { PrismaClient as TenantPrismaClient } from "@/app/generated/tenant-prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const ALGO = "aes-256-gcm";

function getKey() {
  const raw = process.env.TENANT_DB_ENCRYPTION_KEY;
  if (!raw) throw new Error("TENANT_DB_ENCRYPTION_KEY environment variable is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TENANT_DB_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

// A college's database connection string is sensitive infrastructure
// information (spec: "Do NOT store plaintext database passwords ... in
// ordinary application tables") — encrypted at rest, decrypted only inside
// this module, on the server, right before opening a connection.
export function encryptDatabaseUrl(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptDatabaseUrl(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

// Appends/overrides the Postgres `schema` search_path param on a connection
// string — used when a college reuses a shared Postgres server/project but
// still needs its own isolated namespace (no cross-tenant table visibility).
export function withPgSchema(databaseUrl: string, schemaName: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schemaName);
  return url.toString();
}

// Lazy, capped, idle-evicting cache of tenant Prisma clients (spec section
// 9 — never assume "N colleges = N permanently open pools"). Kept on
// globalThis so Next.js dev hot-reloads don't leak a fresh cache (and fresh
// connections) on every file save, matching lib/prisma.ts's pattern.
type CacheEntry = { client: TenantPrismaClient; lastUsed: number };
const IDLE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_CLIENTS = 50;

const globalForTenantDb = globalThis as unknown as {
  tenantClientCache: Map<string, CacheEntry> | undefined;
};
const clientCache = globalForTenantDb.tenantClientCache ?? new Map<string, CacheEntry>();
if (process.env.NODE_ENV !== "production") globalForTenantDb.tenantClientCache = clientCache;

function evictIdle() {
  const now = Date.now();
  for (const [key, entry] of clientCache) {
    if (now - entry.lastUsed > IDLE_TTL_MS) {
      entry.client.$disconnect().catch(() => {});
      clientCache.delete(key);
    }
  }
}

function evictLeastRecentlyUsed() {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of clientCache) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestKey = key;
    }
  }
  if (oldestKey) {
    clientCache.get(oldestKey)?.client.$disconnect().catch(() => {});
    clientCache.delete(oldestKey);
  }
}

// The only place in the app that turns "which college" into "which
// database connection." Every tenant-scoped server action/page goes
// through this, keyed by collegeId resolved from the authenticated
// session — never from anything the client sent directly.
export function getTenantClient(collegeId: string, encryptedDatabaseUrl: string): TenantPrismaClient {
  evictIdle();

  const cached = clientCache.get(collegeId);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.client;
  }

  if (clientCache.size >= MAX_CACHED_CLIENTS) evictLeastRecentlyUsed();

  const url = decryptDatabaseUrl(encryptedDatabaseUrl);
  // The `?schema=` query param is a CLI/migration-time convention (honored
  // by `prisma db push`/`migrate deploy`) — the runtime driver adapter
  // needs the same namespace passed explicitly, or it silently falls back
  // to Postgres's default `public` schema.
  const schema = new URL(url).searchParams.get("schema") ?? undefined;
  const adapter = new PrismaPg({ connectionString: url }, schema ? { schema } : undefined);
  const client = new TenantPrismaClient({ adapter });
  clientCache.set(collegeId, { client, lastUsed: Date.now() });
  return client;
}

// The non-sensitive parts of a tenant's connection string, for the platform
// owner's own database view (spec section 23). Credentials are deliberately
// dropped rather than masked — a Super Admin needs to know *which* database
// a college sits in, never how to authenticate to it directly, and this is
// the only shape that ever leaves the server.
export function describeTenantDatabase(encryptedDatabaseUrl: string): {
  host: string;
  database: string;
  schema: string;
} {
  const url = new URL(decryptDatabaseUrl(encryptedDatabaseUrl));
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, "") || "—",
    // Tables live in a per-college namespace, not `public` — see withPgSchema.
    schema: url.searchParams.get("schema") ?? "public",
  };
}
