# College ERP

A single-college ERP. **One deployment serves exactly one college** — its own
server, its own domain, its own pair of databases. Onboarding a new college
means standing up a new deployment, not adding a row to a shared system.

Isolation is therefore structural rather than enforced by application code:
one college's data cannot leak into another's because no other college's data
exists on the server. There is no tenant routing layer, no stored connection
strings, and no `collegeId` discriminator anywhere in the schema.

## The two databases

| Database | Env var | Holds |
| --- | --- | --- |
| Platform | `PLATFORM_DATABASE_URL` | The college profile, the module catalog, which modules are granted, the Super Admin login, and the platform audit log. |
| College | `COLLEGE_DATABASE_URL` | The college's ERP data: students, faculty, academics, fees, library, plus the college's own users, roles and audit trail. |

They are kept apart so a college user's session can never reach the switches
that decide what that session is allowed to see. The seed refuses to run if
both point at the same database.

## Two identity spaces, one login form

Both sign in at `/login`; where they land is decided by which database the
username was found in, and is then fixed in the signed session.

- **Super Admin** (platform database) → `/platform`. Grants and revokes
  modules, reissues the College Admin password, suspends the college. Has no
  account in the college database and cannot open `/dashboard`.
- **College users** (college database) → `/dashboard`. The College Admin
  decides who on their side may use each granted module.

## Two layers of access control

1. **Has the platform granted this module?** — Super Admin's decision, stored
   in the platform database (`ModuleAccess`).
2. **May this user's role do this action on it?** — College Admin's decision,
   stored in the college database (`Role` / `RolePermission`).

Both are enforced server-side in `lib/auth/dal.ts` on every page and action.
Hiding a nav link is cosmetic; typing the URL directly still returns 403.

Granting a module is a flag flip, not a migration: every deployment carries the
full ERP schema, so a module turns on instantly against tables that already
exist. Enabling one pulls in whatever it cannot work without (Attendance
brings Students and Subjects); disabling cascades the other way.

## Deploying a new college

1. Provision a server, a domain, and **two empty Postgres databases**.
2. Copy `.env.example` to `.env` and fill it in. `AUTH_SECRET` must be unique
   per deployment — a shared secret would let a session minted on one
   college's domain be replayed on another. Generate one with
   `openssl rand -base64 32`.
3. Set `COLLEGE_NAME`, `COLLEGE_CODE`, and `ENABLED_MODULES` (either `all` or
   a comma-separated list of keys).
4. Run the one-time setup:

   ```bash
   npm ci
   npm run db:setup     # generate both clients, migrate both DBs, seed
   ```

   The seed prints the Super Admin and College Admin credentials **once**.
   Both accounts must change their password at first sign-in.
5. `npm run build && npm start`.

### Re-running the seed

`npm run db:seed` is safe to re-run against a live deployment and is how you
apply a renamed college. Two things it deliberately will **not** do:

- **Revoke modules.** `ENABLED_MODULES` decides the *initial* grant only.
  After that the Super Admin's toggles on `/platform` are authoritative, so a
  redeploy carrying a stale env value can never take away a module the college
  is already using.
- **Reset passwords.** Existing accounts keep theirs. To reissue the College
  Admin's password, use *Issue new admin password* on `/platform`.

### Upgrading an existing deployment

```bash
npm run db:migrate   # applies pending migrations to both databases
```

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run prisma:generate` | Builds both Prisma clients |
| `npm run db:migrate` | `migrate deploy` against both databases |
| `npm run db:seed` | Seeds this deployment from the environment |
| `npm run db:setup` | All three, in order — what a fresh deployment runs |

## Layout

```
prisma/schema.prisma          platform (control-plane) schema
prisma/college/schema.prisma  college ERP schema
prisma/seed.ts                deployment bootstrap, reads the environment
lib/prisma.ts                 platform client
lib/college-db.ts             college client
lib/auth/dal.ts               who is logged in and what they may do
lib/permissions.ts            module list, dependencies, the two-layer check
app/platform/                 Super Admin console
app/dashboard/                the college's ERP
```
