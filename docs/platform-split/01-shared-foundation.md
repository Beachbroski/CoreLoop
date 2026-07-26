# W1 — Shared Foundation (workspace + shared schemas)

**Goal:** Restructure the repo so web and mobile can share validation schemas and types without duplication, with minimal churn to the existing Next.js app.

**Why this exists:** The single biggest source of drift between a web backend and a mobile client is duplicated request/response shapes. One Zod schema package, consumed by both, prevents it.

## Scope

- Convert repo to npm workspaces **without moving the Next.js app** (it stays at repo root to avoid Vercel config churn).
- New `packages/shared` workspace: Zod schemas + TS types for every mobile API request/response, plus shared enums mirroring Prisma enums.
- New `mobile/` workspace reserved for W3 (scaffold only lands there).

## Non-goals

- No Turborepo/Nx (overkill for 2 apps + 1 package; revisit if build times hurt).
- No moving `app/`, `lib/`, `prisma/` — the web app's structure is untouched.
- No changes to existing `/api/*` routes.

## Tasks

### W1-1: npm workspaces setup
- Root `package.json` gains `"workspaces": ["packages/*", "mobile"]`.
- Verify `npm install`, `npm run build`, and the Vercel build still work identically. **The web app must build byte-for-byte the same.**
- Check `.vercelignore`/project settings so `mobile/` is excluded from web deploys.

### W1-2: `packages/shared` package
- `packages/shared/package.json`: name `@creatordocks/shared`, TypeScript, exports compiled JS + types (or TS-source consumption if both consumers handle it — verify Expo Metro + Next.js both resolve it; Metro needs `metro.config.js` watchFolders for monorepo packages).
- Dependencies: `zod` only. **No Prisma, no server-only code** — this package ships inside the mobile bundle; anything in it is public.

### W1-3: Shared enums + domain types
- Mirror Prisma enums as Zod enums: `Role`, `CampaignStatus`, `ApplicationStatus`, `SubmissionStatus`, `PayoutStatus`.
- Unit test asserting each Zod enum's values exactly match the Prisma enum values (import Prisma types in the *test* only, which lives web-side) — this test is the drift alarm.

### W1-4: API contract schemas (filled in as W2 defines endpoints)
- One file per resource: `campaign.ts`, `application.ts`, `submission.ts`, `payout.ts`, `user.ts`, `device.ts`.
- Every schema pair: `XRequestSchema` (used by the server to validate input **and** by the app to validate before sending) and `XResponseSchema` (used by the app to validate server responses at runtime — never trust the network, even your own API).
- Response schemas must be **allow-lists** (explicit `.strict()` or field-picked objects), never passthrough — this is the guardrail against accidentally leaking new DB fields to mobile clients.

### W1-5: Shared API error envelope
- Per house pattern: `{ success: boolean; data?: T; error?: string; meta?: { total, page, limit } }`.
- Zod generic helper `apiResponseSchema(dataSchema)` used by every response schema.
- Error messages in the envelope are **user-facing strings only** — no stack traces, no Prisma error text, no internal identifiers (server logs get the detail).

## Security requirements (from W5)

- `packages/shared` is bundled into the mobile binary: treat every string in it as public. No secrets, no internal URLs, no admin-only field names.
- CI check (or lint rule) preventing `packages/shared` from importing anything server-only (`@prisma/*`, `stripe`, `resend`, `@clerk/nextjs`).

## Acceptance criteria

- [ ] `npm install` at root installs all workspaces; web build output unchanged; Vercel deploy green.
- [ ] `@creatordocks/shared` imports cleanly from a Next.js route handler and from a fresh Expo app (verified in W3-1).
- [ ] Enum-drift unit test exists and passes.
- [ ] Error-envelope helper + at least the `user.ts` contract schemas exist with tests.
- [ ] No server-only imports possible in shared package (enforced, not just convention).
