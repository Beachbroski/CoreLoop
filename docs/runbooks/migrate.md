# Migration runbook

## The one fact that matters

**There is exactly one Neon Postgres database.** Local development, Vercel
Preview, and Vercel Production all point at the same `DATABASE_URL` host today
(confirmed by the 2026-09-06 audit — Preview has no separate `DATABASE_URL` at
all, and local `.env*` files point at the same Neon host as production). There
is no per-environment database isolation yet.

This means:

- Anything you run locally against `DATABASE_URL` runs against the data brands
  and creators (once there are real ones) depend on.
- A schema change is not something you can "try" and throw away — there is
  nowhere else to try it.
- `docs/production-readiness-2026-09-06.md` H14 tracks giving Preview its own
  Neon branch. Until that lands, treat every environment as production for
  database purposes.

## Never run `prisma migrate dev`

The current README instructs `npx prisma migrate dev` in its getting-started
section. **Do not run this.** `migrate dev` is designed for a disposable local
database: when it detects drift between the migration history and the actual
schema, its resolution strategy is to reset the database (drop and recreate).
Against the one shared Neon database, that reset is not scoped to "your local
copy" — it is the only copy. This is flagged as dangerous in
`docs/production-readiness-2026-09-06.md` §1 and H15, and fixing the README to
stop recommending it is tracked separately (H15, PROC-04) — this runbook is the
authoritative safe path in the meantime regardless of what the README says at
any given moment.

The hard rule for this repo, restated: **never run `prisma migrate dev`,
`prisma migrate reset`, or `prisma db push` against `DATABASE_URL`.** They are
all schema-writing or drift-resetting commands not designed for a shared
database.

## The safe path

Three read-oriented commands do the inspection work `migrate dev` would
otherwise do for you, without touching data:

### 1. `prisma migrate diff` — inspect before you write anything

Compare your local schema (`prisma/schema.prisma` + whatever you've drafted) to
what's actually applied, without applying anything:

```bash
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

Read the generated SQL. If it contains a `DROP COLUMN`, `DROP TABLE`, a type
narrowing, or a `NOT NULL` added to a column that might hold existing nulls,
stop and think about backward compatibility (the running production code needs
to survive the moment between "migration applied" and "new code deployed" —
they are two separate steps, see §3 below) and about whether you need a
manual backfill step before the migration can run safely.

### 2. `prisma migrate status` — check what's actually applied

```bash
npx prisma migrate status
```

As of 2026-09-06, all three existing migrations
(`20260101000000_init`, `20260726025429_drop_orphaned_business_waitlist_fields`,
`20260726042644_add_device`) are applied cleanly to the shared database, and
`prisma migrate status` reports no drift. Run this first, every time, before
creating or applying anything — it tells you whether the database and the
migration history in `prisma/migrations/` currently agree.

If it reports drift or a failed migration, stop and diagnose before doing
anything else. Do not "fix" drift with `migrate dev` or `db push`.

### 3. `prisma migrate deploy` — the only command allowed to write schema

```bash
npx prisma migrate deploy
```

This applies any migration folders under `prisma/migrations/` that aren't yet
recorded as applied, in order, and does nothing else — no drift detection, no
reset, no schema diffing against your local `schema.prisma`. It is the command
Vercel's own docs and Prisma's own docs recommend for shared/production
databases, and it is the only migration-applying command anyone should run
against `DATABASE_URL` here.

**This is a hand-run step today.** `package.json`'s `build` script is
`prisma generate && next build` — it does not call `migrate deploy`. That means
a Vercel deploy does **not** apply pending migrations for you. If your change
includes a new migration folder, you must run `prisma migrate deploy` yourself,
against the shared database, before (see ordering below) the code that depends
on it goes live. `docs/production-readiness-2026-09-06.md` H7 tracks wiring
this into the build pipeline (gated on `VERCEL_ENV=production` so a Preview
build can't run it); until that lands, this manual step is required every
time.

## Before running `migrate deploy`: take a Neon branch or backup

Because there is one database and no automatic point-in-time safety net you've
verified yourself (Neon's retention window is unconfirmed — `Q-A10` in the
audit), take an explicit snapshot immediately before applying anything:

- **Preferred: a Neon branch.** In the Neon console (or `neonctl branches
  create`), create a branch of the current database state before running
  `migrate deploy`. This gives you a point you can restore from or diff against
  without guessing at Neon's default retention.
- **If you don't have Neon CLI/console access at hand:** at minimum, run
  `pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M%S).sql` locally before
  proceeding, and don't delete it until you've verified the migration.

Do not skip this step because the migration "looks safe" — additive migrations
(new nullable column, new table) are low-risk, but the cost of skipping the
snapshot on the one migration that turns out not to be additive is the entire
shared dataset.

## Order of operations for a migration that ships with a code change

1. `prisma migrate status` — confirm clean starting state.
2. `prisma migrate diff` — read the SQL, confirm it's what you expect.
3. Take a Neon branch / backup (above).
4. `prisma migrate deploy` against the shared database.
5. `prisma migrate status` again — confirm it now reports the new migration as
   applied and no drift.
6. Spot-check the actual schema change landed as expected, e.g.:
   ```bash
   npx prisma studio   # or psql "$DATABASE_URL" -c '\d "TableName"'
   ```
7. Only now deploy the code that depends on the new schema (`deploy.md`).

For a purely additive migration (new nullable column, new table, new index)
this ordering is safe even though DB and app deploy at different times. For a
destructive or narrowing migration (dropping a column the running code still
reads, tightening a constraint), you need an expand/contract sequence instead —
deploy code that stops depending on the old shape first, migrate second, and
never combine "drop this column" with "and also stop using it" in one release
if you can avoid a window where old code and new schema coexist.

## After the migration: verify

- `prisma migrate status` shows the new migration applied, no drift.
- Run the app's own test suites (`npx vitest run`, `npm run test --workspace=packages/shared`)
  against the migrated database if they hit the DB, and confirm nothing that
  depends on the old shape is silently broken.
- Watch Vercel Runtime Logs after the next deploy for Prisma errors
  (`PrismaClientKnownRequestError`, column-does-not-exist, etc.) — see
  `incident.md`.

## If a migration goes wrong

There is no automated rollback for a Prisma migration. Options, worst to best
already avoided by having a branch/backup from the step above:

1. **Best case:** you took a Neon branch — restore from it or point
   `DATABASE_URL` at it while you fix forward.
2. **Write and apply a compensating migration** that reverses the change (e.g.
   re-add a dropped column). This is the normal path for anything that isn't
   catastrophic.
3. **Worst case, no branch/backup exists:** restore from whatever Neon
   point-in-time recovery window is actually configured (verify this in the
   Neon console — do not assume a window exists; `Q-A10` in the audit is
   explicitly unresolved). This is the reason step "take a Neon branch or
   backup" above is not optional.
