// Phase 2 — one build wave. Inline this script into the Workflow tool from the
// orchestrating session with args of the shape:
//
// {
//   wave: 1,
//   worktree: '/Users/jsteele/dev/creatordocks-redesign',   // the feat/web-redesign worktree
//   baseSha: 'abc1234',                                       // commit the wave starts from
//   previewUrl: 'http://localhost:3100',                      // optional; only the orchestrator starts it
//   packages: [
//     { id: 'WP-01', title: 'Design tokens + contrast contract', ownedFiles: ['lib/design-tokens.ts', '...'] },
//     ...
//   ]
// }
//
// Each package: one Opus build agent (owned files only) → one Opus verifier
// (read-only, fresh context). pipeline() means a fast package is verified
// while a slow one is still building. Agents never commit; the orchestrator
// runs scripts/wave-gate.sh and commits per package afterwards.

export const meta = {
  name: 'web-redesign-wave',
  description: 'Build and verify one wave of the CreatorDocks web redesign: one Opus agent per work package in the shared worktree, disjoint file ownership, a verifier per package',
  phases: [
    { title: 'Build', detail: 'one Opus agent per package, owned files only', model: 'opus' },
    { title: 'Verify', detail: 'read-only verifier per package re-runs the gates', model: 'opus' },
  ],
}

const DOCS = '/Users/jsteele/Desktop/CreatorDocks/marketplace/docs/web-redesign-2026-09'
const WT = args.worktree
const WAVE = args.wave
const PACKAGES = args.packages ?? []
if (!WT || !WAVE || PACKAGES.length === 0) throw new Error('args.worktree, args.wave and args.packages are required')
if (PACKAGES.length > 6) throw new Error(`wave ${WAVE} has ${PACKAGES.length} packages; the cap is 6`)

// Disjoint-ownership audit — refuse to start if two packages own the same file.
const owners = new Map()
for (const p of PACKAGES) for (const f of p.ownedFiles ?? []) {
  if (owners.has(f)) throw new Error(`file ${f} is owned by both ${owners.get(f)} and ${p.id}`)
  owners.set(f, p.id)
}

const GATES = 'npm run typecheck && npm run lint && npm run test && npm run test --workspace=packages/shared'

function standingRules(p) {
  return `
STANDING RULES (00-PLAN.md §5 — every one is a gate, not advice):
1. You work ONLY in the worktree ${WT} (branch feat/web-redesign). You own EXACTLY these files and may create or edit nothing else:
${(p.ownedFiles ?? []).map(f => '   - ' + f).join('\n')}
   If you believe you need another file, STOP and say so in your result. Do not touch it.
2. NEVER edit app/globals.css (unless your package is WP-26), anything under app/(dashboard)/creator/ or app/internal/, app/DashboardNavShell.tsx, app/(dashboard)/AdminViewBanner.tsx, app/(dashboard)/ChangeRoleControl.tsx, prisma/, proxy.ts, package.json (unless it is in your owned list), or any flag default in lib/creator-web-mode.ts / lib/admin-config.ts.
3. ONE DATABASE, AND IT IS PRODUCTION. Never submit a form, click a mutating control, or send POST/PATCH/DELETE to any server. Never run prisma migrate / db push / set-role.mjs. Verify mutating states from fixture-rendered component tests only.
4. Never start a dev server; never touch ports 3000, 3100 or 8081. ${args.previewUrl ? `A read-only preview is running at ${args.previewUrl}; you may load pages in a browser tool but never interact with a form or button that writes.` : 'No preview server is available to you in this wave.'}
5. Never commit. Never run git commands that change state (no add/commit/stash/checkout/reset). git status / git diff are fine.
6. Never read .env* files. Never print secrets.
7. Read before writing: ${DOCS}/00-PLAN.md §3 and §5; your package "${p.id}" in ${DOCS}/02-engineering.md §3 (the acceptance criteria are the contract); the pages of ${DOCS}/01-design-brief.md your files render; AGENTS.md at the worktree root (this Next.js version differs from your training data — read node_modules/next/dist/docs/ for any API you touch).
8. TDD: write the test first, run it red, implement, run it green. Component tests belong to the "ui" vitest project, pure logic to "node".
9. House rules: files 200–400 lines (800 max), functions under 50 lines, immutable data, explicit error handling, no colour or size literal outside lib/design-tokens.ts, no style={{}} except to set a --cd-* custom property with a genuinely dynamic value, no !important, no new NEXT_PUBLIC_* variable, no process.env inside any 'use client' file.
10. Anti-template rules are gates (01 §9): no backdrop-filter, no filter: blur, no radial-gradient, no radius 18–40px, no pill buttons, no eyebrows, no uppercase labels, no 01/02/03 chips, no emoji, no arrows in labels, no scroll reveals, no hover transforms, no shimmer, no monospace.
11. Money copy is derived, never typed: the percentage comes from PLATFORM_FEE_RATE(); "out of" the rate, never "plus"; money buttons carry the number; the brand's charge and the creator's net always appear as a pair.
12. Work file by file. Run "npx tsc --noEmit" after each file. Never leave a file unparseable across a tool-call boundary.
`
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'blocked', 'partial'] },
    filesTouched: { type: 'array', items: { type: 'string' } },
    nodeVersion: { type: 'string' },
    gateOutput: { type: 'string', description: 'verbatim tail of typecheck, lint, test (with counts), shared test' },
    testCount: { type: 'integer' },
    designGateOutput: { type: 'string', description: 'verbatim output of scripts/design-gate.sh over the owned files, or "script not present yet" in wave 1' },
    acceptance: { type: 'array', items: { type: 'object', properties: { criterion: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['criterion', 'met', 'evidence'] } },
    blockedOn: { type: 'string' },
    guessList: { type: 'string' },
    modelSelfReport: { type: 'string' },
  },
  required: ['status', 'filesTouched', 'nodeVersion', 'gateOutput', 'testCount', 'acceptance', 'guessList'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    summary: { type: 'string' },
    unownedFilesTouched: { type: 'array', items: { type: 'string' } },
    gatesGreen: { type: 'boolean' },
    gateOutput: { type: 'string' },
    testCount: { type: 'integer' },
    failedCriteria: { type: 'array', items: { type: 'object', properties: { criterion: { type: 'string' }, evidence: { type: 'string' } }, required: ['criterion', 'evidence'] } },
    designGateHits: { type: 'array', items: { type: 'string' } },
    guessList: { type: 'string' },
  },
  required: ['verdict', 'summary', 'unownedFilesTouched', 'gatesGreen', 'gateOutput', 'testCount', 'failedCriteria', 'designGateHits', 'guessList'],
}

function buildPrompt(p) {
  return `You are the Opus 5 build agent for work package ${p.id} — ${p.title} — wave ${WAVE} of the CreatorDocks web redesign.
${standingRules(p)}
YOUR TASK: implement ${p.id} exactly as specified in ${DOCS}/02-engineering.md §3 (find the heading "#### ${p.id}") and the design brief sections it references, satisfying every acceptance criterion. Only your owned files. When done, run from ${WT}:
  node -v
  ${GATES}
  git status --short
  git diff --stat
  bash scripts/design-gate.sh ${(p.ownedFiles ?? []).join(' ')}   (if the script exists; it is created by WP-03 in wave 1)
and return the structured result. In "acceptance", list every criterion from your package with met=true/false and the evidence. If anything in the spec is impossible or contradicts the code you found, set status "blocked" and explain in blockedOn — do not improvise around it. End with the guess list (what was unclear, what you guessed; "nothing" is acceptable, silence is not).`
}

function verifyPrompt(p, build) {
  return `You are the READ-ONLY verifier for work package ${p.id} — ${p.title} — wave ${WAVE}. You edit nothing. You run only read-only commands and the gates.
${standingRules(p)}
The build agent reported:
${JSON.stringify(build, null, 2)}

Do not trust that report. In ${WT}:
1. Run: node -v; ${GATES}. Paste the tails verbatim and the test count.
2. Run: git status --short and git diff --stat. List every changed/created file that is NOT in the owned list above (other packages in this wave own other files — compare against the owned list only, and report files that no package in this wave could own as unowned: anything under app/(dashboard)/creator, app/internal, app/globals.css, the three shared dashboard components, prisma/, proxy.ts, .env*).
3. Open ${DOCS}/02-engineering.md §3 "#### ${p.id}" and check EVERY acceptance criterion against the actual files, not the report. Read the test files: do they test behaviour, or do they mock the thing under test into a passthrough?
4. Run bash scripts/design-gate.sh over the owned files if the script exists; grep the owned files yourself for backdrop-filter, radial-gradient, "filter: blur(", border-radius 18–40px, style={{ without --cd-, hex literals outside lib/design-tokens.ts and the OG routes, !important, text-transform: uppercase, "use client" files containing process.env.
5. Verdict "fail" if any gate is red, any unowned file was touched, any criterion is unmet, or any design-gate hit exists in a file this package created. Otherwise "pass".
End with the guess list.`
}

phase('Build')
log(`Wave ${WAVE}: ${PACKAGES.length} packages → ${PACKAGES.map(p => p.id).join(', ')}`)

const results = await pipeline(
  PACKAGES,
  p => agent(buildPrompt(p), { label: `build:${p.id}`, phase: 'Build', model: 'opus', effort: 'high', schema: BUILD_SCHEMA }),
  (build, p) => {
    if (!build) { log(`${p.id}: build agent returned nothing — orchestrator must git checkout its owned files and re-dispatch`); return { package: p.id, build: null, verify: null } }
    log(`${p.id}: build ${build.status}, ${build.testCount} tests — verifying`)
    return agent(verifyPrompt(p, build), { label: `verify:${p.id}`, phase: 'Verify', model: 'opus', effort: 'high', schema: VERIFY_SCHEMA })
      .then(verify => ({ package: p.id, build, verify }))
  },
)

const summary = results.filter(Boolean).map(r => ({
  package: r.package,
  build: r.build?.status ?? 'missing',
  verdict: r.verify?.verdict ?? 'missing',
  unowned: r.verify?.unownedFilesTouched ?? [],
  testCount: r.verify?.testCount ?? null,
}))
log(`Wave ${WAVE} done: ${summary.filter(s => s.verdict === 'pass').length}/${PACKAGES.length} passed verification. Now run scripts/wave-gate.sh yourself before committing anything.`)

return { wave: WAVE, baseSha: args.baseSha, summary, results }
