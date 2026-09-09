# Phase 1 mockup reviews (archive)

_Two adversarial Opus reviewers read the seven artboards on 2026-09-08. Blockers and majors were applied by the fix pass; minors are listed for the owner and for Phase 2._

## Lens: fidelity — verdict: needs-fixes

The set is unusually faithful. All seven §10 artboards exist and carry their required contents; canvas.json parses, lists every .dc.html, declares no overlapping frames and launches on the canvas. The reduced gate is clean on every hard rule I could grep: zero backdrop-filter, filter: blur(, radial-gradient, text-transform: uppercase, text-align: center, arrows, emoji, eyebrows, 01/02/03 markers; every font-variation-settings declaration sets wdth and wght together; exactly one <script src="./support.js"> per file and no inline script; every 999px is an avatar/initials disc or a 6–8px dot; the only linear-gradients are the 135deg cover-art bases. Money reconciles everywhere against the §10 fixture (committed 950 = 400+300+250; still owed 700; charged 250 incl. 37.50 fee; to creators 212.50; Marcus 425/63.75/361.25; pipeline 11/3/2/1/1 matches the table's 6+4+1 applicants; bar widths 27.27% and 18.18% are literally 3/11 and 2/11); every fee line is a real U+2212 (written as &minus;) in #9ba1ae, never #f55b7f. CTAs are invite-mode with open-mode annotations on the hero and closing slots. I recomputed 30+ of Tokens.dc.html's stated ratios with the WCAG formula from scratch: all eight dark foregrounds × four grounds match to the digit (18.85/17.31/16.37/15.66, 7.73/7.10/6.71/6.42, 5.33/4.89/4.63/4.43, 6.17/5.66/5.36/5.13, …), as do white-on-accent-fill 4.51, accent-strong 5.41, white-on-accent 3.25, light accent-fill 4.52/5.42/4.22, dark accent on light canvas 3.03, darker-palette-stop range 5.88–15.99, and the "7 of 8 lighter stops below 4.5" claim; the soft-chip figures differ from mine by ≤0.03, which is float-vs-8-bit compositing, and the sheet's scrim 7.66 is the float-accurate value the brief rounded to 7.63. baked-specs.json is algorithmically correct — I reimplemented FNV-1a/fraction/palette-by-niche/pattern-by-id in Python and all 10 campaign+onboarding specs and all 32 palette-grid cells match exactly, including decor to 1e-12; every painted art block I could parse reproduces the §5 render rule (size = d.size × height × 1.5, ring at ×2.2 for arc[0], stripe at ×2.4 by height×0.16). DashboardLight is byte-identical to Dashboard after normalising every hex and rgba() — zero structural diff — and its palette is the §2 light set with #ff503d surviving only on the brand mark, as §2's theme-independent brand constant requires. One blocker: the canvas frame for the mobile landing is 2,728px shorter than the artboard, so a quarter of artboard 2 is not on the canvas the owner reviews.

### [blocker] canvas.json (line 6) + Landing390.dc.html (line 27)

The Landing390 frame is declared at h 7200 but the artboard is 9,928px tall, so roughly the bottom 28% of artboard 2 — the rest of the agency comparison, "Creators are on iPhone", the whole FAQ, the coral closing band and the footer — falls outside the frame, and the frame's true extent collides with the SignIn frame.

**Evidence.** canvas.json: { "file": "Landing390.dc.html", "x": 0, "y": 6560, "w": 390, "h": 7200 }. Landing390.dc.html line 27 root: min-height: 10000px. Measured in a browser: natural content height 9,928.18px (min-height forces 10,000). Section tops measured from the artboard origin: hero 69, what-it-costs 1348, how-it-runs 1967, who-this-is-for 2784, why-not-an-agency 5923-7388, creators-on-iPhone 7388, FAQ 8289, closing band 9313, footer 9656-9928. y=7200 lands mid-way through "Why not an agency". At the real height the frame spans y 6560-16488 at x 0-390, which intersects SignIn (x 0-1440, y 13900-14800) over a 390x900 region. Same root cause, smaller effect, on artboards 3 and 4: Dashboard/DashboardLight content measures ~1,267px against a declared and min-height-forced 1,900px, leaving ~630px of dead canvas under the pipeline. canvas.json is timestamped 12:40; Landing390.dc.html 13:06 — the artboards grew after the layout was written.

**Fix.** Set Landing390's canvas.json h to 10000 to match the artboard's own min-height (or trim the min-height to the real 9928 and set both to that), then re-flow the rows below it: move SignIn and Tokens down so nothing sits inside y 6560-16560 at x 0-390. Re-derive every h in canvas.json from the artboards' current min-height values rather than the values they had at 12:40, and drop Dashboard/DashboardLight to ~1300 so those two frames are not a third empty.

### [minor] Main.dc.html (line 178, art-strip tile 7)

A generated stripe decor element renders border-radius: 19.2px, which is inside the banned 18-40px band and will fire the §9 rule 5 grep when the same geometry is ported to components/CoverArt.tsx.

**Evidence.** Main.dc.html line 178, inside the full-bleed art strip: the stripes pattern is baked as a half-height pill (240px tile → stripe height 38.4px → border-radius 19.2px) instead of §5's literal `stripes → border-radius: 999px`. tools/cover-art-bake.mjs applies the same half-height rule everywhere (e.g. 3.2px on the 40px dashboard thumb). The brief contradicts itself here: §5 mandates 999px for stripes, and the mockup gate forbids 999px on anything but avatars and the status dot, so no value satisfies both.

**Fix.** Decide the conflict explicitly and write it down before Phase 2: either restore §5's `border-radius: 999px` and add "cover-art stripe decor" to the 999px allowlist in scripts/design-gate.sh, or keep the half-height pill and add a documented carve-out to the 18-40px rule for aria-hidden decor inside CoverArt. Visually the two are identical; only the grep differs.

### [minor] Main.dc.html (lines 136, 147, 158) and Landing390.dc.html (lines 119, 130, 141)

The "How it runs" step markers use border-radius: 2px, a value that is not on the §4 radius scale and contradicts §7's explicit instruction that they carry --cd-radius-1.

**Evidence.** Six identical spans: <span style="width: 8px; height: 8px; border-radius: 2px; background: #ff503d; …">. §7 section 3 specifies "8px coral squares (--cd-radius-1) at each step's cap-height", and §4 defines the scale as 0 / 4 / 6 / 10 / 14 / 999 with nothing in between. Tokens.dc.html's own radius section tells the owner the system has exactly six radii, so approving this artboard approves a seventh.

**Fix.** Change all six to border-radius: 4px so the marker matches --cd-radius-1 and the specimen sheet's claim stays true.

### [minor] Main.dc.html (line 42), HeroA.dc.html (line 42), Landing390.dc.html (nav CTA)

The nav CTA renders in invite mode but carries no open-mode annotation, so one of the four §8 CTA slots is presented to the owner without the label it will show once MARKETPLACE_ACCESS=open.

**Evidence.** §10 requires "All CTAs render in invite mode (Request access → /waitlist), with the open-mode label shown as an annotation beside the CTA". Annotations exist only at the hero (Main:56, HeroA:56, Landing390:47 — "Create your brand account") and the closing band (Main:464, Landing390:460 — "Post your first brief"). The nav's <a href="/waitlist">Request access</a> has none, and per §8 its open-mode label is "Get started", not "Create your brand account" — so the owner cannot see that the nav label changes at all.

**Fix.** Add the same 13px --cd-text-secondary annotation beside the nav CTA reading: Open mode label: "Get started", /sign-up. On Landing390, where the bar is tight, place it under the header rather than inside it.

### [minor] Dashboard.dc.html / DashboardLight.dc.html (line 120, "Needs you")

Marcus Ilagan's pending $425.00 application is attached to "Saturday brunch reels", a $400.00 campaign that already has Ana Reyes accepted at $400.00, so the dashboard's headline decision is an over-budget bid on a brief that is already filled.

**Evidence.** Line 120 places Marcus on "Saturday brunch reels"; the campaigns table (lines 159-176) shows that campaign at $400.00 budget / Active, and the Tokens reconciliation table plus the money strip both count Ana Reyes as accepted and held at $400.00 on it. §10's fixture gives Marcus a $425.00 ask but never says which campaign he applied to. Nothing is arithmetically wrong — committed $950.00 and still owed $700.00 both still reconcile — but "Accepting holds $425.00" on a $400.00 brief that already has its creator is a story the owner will read as a bug in the money model rather than a fixture choice.

**Fix.** Move Marcus onto a campaign where a $425.00 ask is coherent — either "New cold brew tasting" if you want an over-ask, or add a fourth Active brief with no accepted creator. If he stays where he is, add the applicants-vs-spots detail that makes it legible (Saturday brunch reels is already 6 applicants for 2 spots, so a second slot is open).

**Reviewer guess list.** Five things I had to guess or could not verify:

1. **How the canvas renderer treats a declared h smaller than the artboard's content** — clip, or grow the frame. I could not verify this from anything in the repo. I described the Landing390 failure as a clip at y=7200 because that is the worse-looking case; if the renderer grows the frame instead, the cut disappears but the 390x900 collision with the SignIn frame becomes the failure. The fix is the same either way, so I did not let the ambiguity change the severity.

2. **support.js does not exist in the mockups directory.** Every artboard loads `<script src="./support.js">`. I assumed the design-canvas runtime injects it at publish time (that is the skill's convention and the instruction explicitly whitelists "the support.js line"), so I did not report it as a missing asset. If it is meant to be a committed file, it is missing and I was wrong to pass it.

3. **Height measurements were taken in a preview pane that scales artboards wider than it.** Main and Dashboard came back at 0.55x and I divided out; Landing390 (390px) and Tokens (1200px) rendered at 1:1 so their figures are direct. Google Fonts reported `document.fonts.status === "loaded"`, so the numbers are with real Archivo/Schibsted metrics, but a different renderer could shift Landing390's 9,928px by tens of pixels — not by the 2,728px that matters.

4. **The §5-vs-gate conflict on stripe decor radius has no correct answer in the source documents**, so my "minor" severity is a judgment call rather than a reading. §5 says 999px; the gate bans 999px outside avatars and status dots; the mockup picked half-height and landed at 19.2px, which the other gate bans. Someone has to decide, and I could not tell from 00-PLAN.md or the brief which rule the owner considers load-bearing.

5. **I composited alpha fills at 8-bit precision; the token sheet appears to composite in float.** That is the whole of the ≤0.03 gap on the ten *-soft rows and the scrim (my 7.63 vs the sheet's 7.66, matching the brief's 7.63). I treated the sheet as the more accurate of the two and did not report it, but I did not read tools/build-tokens.mjs's compositing code to confirm that is actually why — I inferred it from the sign and size of the differences.

Two things I deliberately did not check, because they were out of scope for this lens: whether the artboards are visually attractive, and whether tools/build-tokens.mjs and tools/cover-art-bake.mjs are themselves well-written (I only verified that their *output* matches the algorithm in mobile/src/lib/cover-art.ts and the WCAG formula).

---

## Lens: creative-director — verdict: needs-fixes

This is far above the AI-dark-SaaS baseline. The slip genuinely reads as a receipt (hairline dl rows, condensed tabular figures, U+2212 in text-secondary, the named-creator net line), the agency comparison is a real table, the FAQ is a real definition list, the "how it runs" ordinals are set as the heading's first word against a coral hairline rather than 01/02/03 chips, and the Tokens money section — including "the number $488.75 does not exist anywhere in this product" — is the work of someone who understood the thesis. Every gate grep is clean: no backdrop-filter, no blur, no radial-gradient, no banned radius, no uppercase, no eyebrows, no arrows, no mono, no centered text, no banned words, no exclamation marks. Every figure reconciles against the §10 fixture (Committed 950 = 400+300+250; Still owed 700; Charged 250 incl. 37.50; To creators 212.50; pipeline 11/3/2/1/1 matches applicants 6+4+1; Marcus 425/361.25; Deshawn 300/255), and the baked cover art matches the FNV-1a algorithm exactly — I re-ran it. What stops approval is three things the owner would be approving falsely: the canvas ships two different brand marks, the mobile artboard overruns its frame by 2,800px into the sign-in board, and the light dashboard is five pure-white surfaces on near-white with no elevation at all, so artboard 4 cannot answer the one question it exists to answer. Beneath those, the page still spends coral 22 times, the dashboard still resolves into four identical rounded boxes, and the pairing test — the sheet's stated reason to exist — tests a type setting that ships nowhere.

### [blocker] SignIn.dc.html (vs Main.dc.html, HeroA.dc.html, Landing390.dc.html, Dashboard.dc.html, DashboardLight.dc.html)

The canvas ships two different brand marks, so whichever option the owner picks, most of the artboards they are approving are wrong.

**Evidence.** SignIn.dc.html:38-41 renders Option B, the drawn slip SVG (`<path d="M7 4.5 H19 V19.2 L17 21.3 ..."`) in the page lockup. Main.dc.html:31, HeroA.dc.html:31, Landing390.dc.html:31 and Dashboard.dc.html:37 all render Option A, the coral tile with a set "D" in Archivo wdth 100/wght 800 — and Dashboard.dc.html:36 comments it as "Brand mark, Option A." Tokens.dc.html:1273 says "Pick one; the other is deleted rather than kept as a variant," but the canvas has already shipped both. Under 00-PLAN §4 the owner approves each artboard separately and Phase 2 builds only approved pages, so approving auth means approving a mark that contradicts the other five boards, and D2's "one identity" is exactly what is on the table.

**Fix.** Pick a single mark for the whole canvas and re-render every lockup with it — the presentation of the choice belongs only in Tokens §The brand mark, never in a page artboard. Given the thesis, ship Option B everywhere on the canvas (it is the slip, it has no webfont dependency, and Option A's own caption at Tokens.dc.html:1187 concedes it falls back to Arial in the OG route, the favicon and email); keep Option A alive only as the losing candidate inside the Tokens comparison.

### [blocker] Landing390.dc.html / canvas.json

The mobile artboard is 2,800px taller than the frame declared for it and runs into the Sign in artboard, so artboard 2 cannot be reviewed as laid out.

**Evidence.** Landing390.dc.html:27 sets `min-height: 10000px` — a hard floor, so the board is at least 10,000px tall regardless of content. canvas.json declares `{ "file": "Landing390.dc.html", "x": 0, "y": 6560, "w": 390, "h": 7200 }`. 6560 + 10000 = 16560, while `SignIn.dc.html` is placed at `y: 13900` in the same x-column (x: 0). Either the board is clipped 2,800px short of its own footer, or it overlaps the sign-in board by 2,660px. Main.dc.html:27 (6400) and Dashboard.dc.html:27 (1900) both match their canvas.json heights, so this is a single stale number, not a convention.

**Fix.** Measure the rendered height of Landing390 and set `min-height` and canvas.json's `h` to the same value, then re-space the third canvas row (SignIn/Tokens) below it with the same 160px gutter the other rows use. If 10,000px is the real content height, the row at y 13900 has to move to roughly y 16720.

### [blocker] DashboardLight.dc.html

Light mode ships with no elevation of any kind — sidebar, all four panels and the page are white or near-white separated only by a 1.18:1 hairline — so the artboard cannot demonstrate the thing it exists to prove.

**Evidence.** `grep -c box-shadow DashboardLight.dc.html` returns 0. DashboardLight.dc.html:33 (sidebar), :89 (money strip), :115 (Needs you), :145 (campaigns), :224 (pipeline) all carry `background: #ffffff` with `1px solid rgba(15,23,42,0.08)`, on a `#f5f7fb` canvas. The brief defines `--cd-elev-2` for light specifically because "in light mode, lightness is capped at white, so elevation is carried by shadow" (01 §2), and it appears nowhere. Contrast between the panels and the canvas is 1.08:1 and the border is rated 1.18:1 — the sidebar, which is the page's primary structural division, is the same fill as the content panels it sits beside. In dark the same markup works because #12141b against #07080b sits in a range where the eye reads the step; at the top of the light range it does not. 00-PLAN §4 asks the owner to approve "that light mode is a real, shippable workspace and not an afterthought," and this board cannot support that answer.

**Fix.** Give light mode its own recipe rather than a recolour of dark's: drop the sidebar to `--cd-bg` (#f5f7fb) so the main column is the lit surface, raise the four content panels to level 2 (`--cd-bg-raised` = #ffffff plus `--cd-elev-2`), and keep the 1px `--cd-border` as the edge rather than the only cue. That is the brief's own stated mechanism — one per theme, lightness on dark, shadow on light — and it costs nothing but a token swap on five elements.

### [major] Main.dc.html

Coral has stopped meaning anything on the landing page: 22 accent-fill surfaces, 19 of them price pills, and on the coral-ember artwork the pill disappears into the art it sits on.

**Evidence.** `grep -c 'background: #d64131' Main.dc.html` = 22, of which 19 are price pills; a further 15 elements are filled `#ff503d`. Four of those pills sit on the "coral ember" palette: Main.dc.html:262 puts `background: #d64131` on `linear-gradient(135deg, #ff6a58 0%, #c22514 100%)` (Casa Duarte, $500), and the same collision repeats at :207 (Terrapin, $350) and twice in the art strip at :175 and :176. I verified against mobile/src/lib/cover-art.ts that this is correct algorithm output, not a mockup error — hash('lifestyle') % 8 = 0, which is the coral palette. The result contradicts §1's "the only saturated colour is real campaign artwork" and §1's "spend boldness in one place": coral now reads as "a price," not as CreatorDocks.

**Fix.** Take the price pill off `--cd-accent-fill` and put it on `--cd-art-scrim` with the amount in white `data` type — §5 already rates white on that scrim at 7.63:1 against the worst palette stop, so the recipe exists and needs no new token. That leaves coral-as-fill on exactly the three things that move money (nav CTA, hero CTA, closing band), makes the pill legible on the coral-ember tiles, and lets the artwork be the only saturated colour, which is what §1 promised.

### [major] Dashboard.dc.html

The workspace resolves into four identical rounded cards stacked down the page, and the campaigns table is boxed at radius 10 when the brief specifies it as a rule at radius 0.

**Evidence.** Dashboard.dc.html:89 (money strip), :115 (Needs you), :145 (campaigns), :224 (pipeline) are four siblings each carrying the identical recipe `border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; background: #12141b`. 01 §7 specifies the campaigns table with "Sticky header row, `--cd-radius-0`, bottom hairline" and §4 says sharp corners are "where a structure is a rule, not an object" while 10 is for "cards, panels… things you could pick up." Wrapping the table and the Needs-you list in 10px panels converts both from rules into objects, and four sibling elements sharing identical padding + radius + border + background is the card-kit tell §9.16 was written to catch.

**Fix.** Unbox Campaigns and Needs you: run them at `--cd-radius-0` full-bleed in the 1112px main column, top hairline under the `label` header row, 1px row rules, no outer border and no fill — exactly the grammar the landing's agency table already uses at Main.dc.html:302. That leaves the money strip as the single object on the page, which is right: it is the one balance sheet, and everything below it is a list.

### [major] Tokens.dc.html

The pairing test — the sheet's stated reason to exist — compares a type setting that ships nowhere, and skips the two places the faces actually collide.

**Evidence.** Tokens.dc.html:635 says "If the two lowercase settings do not read as two clearly different voices at this size, the pairing has failed," then at :638-639 sets the specimen in Archivo `wdth 105 / wght 400` at 17px. Nothing in the §3 scale sets Archivo at weight 400 — the display roles are 600–700 and the data roles are 500–600. The real collisions are elsewhere and both are on the dashboard: `h2` Archivo `wdth 100 / 600` at 22px sitting directly above `h3` Schibsted 600 at 17px (Dashboard.dc.html:114 over :120), and `data` Archivo `wdth 88 / 500` at 15px set inline inside a Schibsted sentence (Dashboard.dc.html:124). Compounding it, `h1` is `wdth 105` and `h2` is `wdth 100` — at or below the bottom of the range §3 itself calls "Archivo Expanded (wdth 105–118)" — so the dashboard's headings are set at the family's most neutral, most Schibsted-like width, and the shopfront character never reaches the workspace at all.

**Fix.** Replace the specimen at :636-645 with the two adjacencies that ship — the h2-over-h3 stack and a money line with `data` inline in `body` — at their real settings. Then raise dashboard `h1` to `wdth` 112 and `h2` to `wdth` 105 so the width axis is always visibly doing work and Archivo never means "a slightly wider UI heading."

### [major] Tokens.dc.html / SignIn.dc.html

Option B is the right idea drawn too thinly to ship: two shapes, with the one distinguishing feature admitted to vanish at favicon size.

**Evidence.** The path at Tokens.dc.html:1205 and SignIn.dc.html:40 is a rectangle from x7–19, y4.5–19.2 in a 26-unit viewBox — 46% of the tile wide — with three perforation teeth 2 units wide and 2.1 deep, and one knocked-out bar at y10.4–12.9. At the 16px favicon size the teeth are 1.2px wide and 1.3px deep. The sheet's own caption at :1228 concedes "At 16px the three perforation teeth soften into one edge," which leaves a plain white rectangle with a horizontal gap through it — a generic document glyph, or a strikethrough. At 512px (:1265) the same two shapes leave the tile looking underfilled: a narrow white slab with one bar.

**Fix.** Keep the concept and give it enough drawing to survive: widen the body from 12 to about 16 units so it fills the tile, cut the teeth to three at roughly 4 units wide × 2.5 deep so they still read at 16px, and replace the single bar with two unequal rules — a long label rule and a short right-aligned figure rule beneath it. That makes the mark literally draw a ledger row, which is the product, and it fixes the favicon and the 512px case in the same move. Re-render the 16/26/40/64 strip and judge it there.

### [minor] SignIn.dc.html

In invite mode the sign-in screen gives the visitor two contradictory routes to an account, 600px apart.

**Evidence.** SignIn.dc.html:52 reads "No account yet? Request access" linking to /waitlist, while :127 in the right-hand form reads "Don't have an account? Sign up" linking to /sign-up. The whole canvas is specified to render in invite mode (01 §10), and 01 §7 gives sign-in one sub-line that "points to sign-up or, in invite mode, to the access CTA" — singular.

**Fix.** Make the Clerk `footerActionLink` flag-aware like every other CTA and drop the duplicate. In invite mode the form's footer should say "Request access" → /waitlist, or the left-panel line should carry it alone and the footer link should be removed.

### [minor] SignIn.dc.html

The focus-state spec note is drawn as a real UI panel inside the form column, so it reads as a second form on the page.

**Evidence.** SignIn.dc.html:131-141 renders a level-2 panel (`background: #171a22`, 1px border, radius 10) containing a labelled, filled email input, sitting 40px below the live form inside the same 400px column of the 792px auth panel — the same visual weight as the thing it annotates. Every other annotation on the canvas is 13px secondary text set beside the element (e.g. Main.dc.html:56).

**Fix.** Demote it to the canvas's own annotation grammar — move it outside the 792px panel onto the artboard margin, or reduce it to a 13px `--cd-text-secondary` caption plus the focused input alone, with no panel chrome around it.

### [minor] Main.dc.html

The landing footer sets a caption in --cd-text-faint, contradicting the demotion the owner is asked to approve on the same canvas.

**Evidence.** Main.dc.html:472 sets "Brooklyn, NY" in `color: #7d8492`. Tokens.dc.html:57-58 asks the owner to approve that `--cd-text-faint` "is rated as a non-text token at 3:1 and no sentence may be set in it. Every caption on the site moves up to --cd-text-secondary." It clears 4.5:1 on the dark canvas so nothing breaks here, but the same pattern in light mode is 3.59:1, and the artboard is the reference build agents will copy.

**Fix.** Move it to `--cd-text-secondary` (#9ba1ae), matching the footer links beside it. Landing390.dc.html carries the same hit and needs the same change.

**Reviewer guess list.** 1. I could not render the artboards in this pass — this was a read-only source review with no screenshots. Every typographic judgment (whether Archivo Expanded and Schibsted read as two voices, whether the 88px headline fills the 1200px measure, whether the drawn mark holds at 16px) is computed from the declared axis settings, sizes and SVG path geometry rather than seen. The mark finding and the pairing finding would both be settled definitively by screenshots at 16/26/512px and of the h2-over-h3 stack; I would take those before acting on my proposed path changes.

2. I assumed the canvas renderer treats canvas.json's `h` as the artboard frame. If it instead auto-sizes to content, the Landing390 finding changes shape — it becomes a 2,800px black tail below the mobile footer and a wrong gutter to the row beneath, rather than an overlap with SignIn — but one of the two numbers is still wrong by 2,800px either way.

3. The coral price-pill finding is a conflict inside the brief, not a deviation by the artboard agent: §5 explicitly specifies `--cd-accent-fill` for the price pill, while §1 and §9.20 say coral is spent once and the artwork is the only saturated colour. I read the artboard as faithful and the brief as self-contradictory at 19 tiles, and framed it as an owner decision. If the owner prefers the pill to stay coral, the narrower fix is to keep it coral everywhere except on the two coral-ember palettes.

4. Same shape for the light-mode blocker: DashboardLight is faithful to the letter of §2's level table (light level 1 = fill + border, no shadow). I judged it fails the intent, and the fix I proposed changes the brief's own recipe rather than the artboard. That is a call the owner should make explicitly.

5. I read only the documents named in my brief — 00-PLAN §1–§3 (I read the whole file), all of 01-design-brief.md, the mobile cover-art files, lib/utils.ts and the frontend-design skill. I did not read 02-engineering.md, 03-risk-verification.md or 09-panel-critiques.md, so I cannot say whether any of these findings are already tracked there.

6. I verified the baked cover art by re-implementing coverArtSpec from mobile/src/lib/cover-art.ts and checking palette selection per niche; the artboards match. I did not spot-check every decor coordinate in tools/baked-specs.json against the generator — I checked palette, pattern and decor count for the tiles I cited.

---

## Fix pass result

```json
{
  "applied": [
    "blocker · canvas.json + Dashboard/DashboardLight — re-derived every frame height from the artboards' current min-height rather than the stale 12:40 values. Dashboard and DashboardLight now declare min-height 1400px and h 1400 (measured content ≈1230px after the unboxing below, ~14% slack) instead of a min-height-forced 1900 against 1900, so neither frame is a third empty. Tokens h raised 11200 → 11600 because its content grew slightly in this pass and it could not be measured in a browser here. Verified no two frames intersect; row gaps ≥120px, in-row gaps ≥80px.",
    "blocker · one brand mark on the whole canvas — Option B (the drawn slip) now renders in every page lockup: Main.dc.html:31, HeroA.dc.html:31, Landing390.dc.html:31, Dashboard.dc.html:37, DashboardLight.dc.html:37, SignIn.dc.html:38, plus the nav and sidebar lockups in tools/shared-snippets.html. Zero set-letter 'D' lockups remain outside the Tokens comparison. Option A survives only inside Tokens.dc.html §The brand mark, explicitly framed as the losing candidate; the sheet's intro, its decision-list row and its closing line now say the canvas is drawn with B and that choosing A means re-marking five artboards.",
    "blocker · Option B redrawn to survive 16px and fill 512px — the path is now \"M5 4.5 H21 V18.6 L18.3 21.1 L15.7 18.6 L13 21.1 L10.3 18.6 L7.7 21.1 L5 18.6 Z M6.6 8.2 H16.6 V10.4 H6.6 Z M14 12.6 H19.4 V14.8 H14 Z\". Body widened 12 → 16 units of the 26-unit tile (46% → 62% wide); three perforation teeth at 5.33 units wide × 2.5 deep (3.3 × 1.5px at a 16px favicon, up from 1.2 × 1.3px); the single knocked-out bar replaced by two unequal rules — a 10-unit label rule with a 5.4-unit right-aligned figure rule beneath it — so the mark literally draws a ledger row. The 16/26/40/64/192/512 strip in Tokens re-renders from the same path, and the three captions that conceded the old mark's weaknesses were rewritten to state the new geometry.",
    "blocker · DashboardLight now has a real elevation recipe of its own instead of a recolour of dark's. The sidebar drops from #ffffff to --cd-bg (#f5f7fb), the main column rises to --cd-bg-element (#ffffff) so it is the lit surface, and the money strip — the one remaining panel — sits at level 2 (#ffffff + --cd-elev-2: 0 1px 2px rgba(15,23,42,0.06), 0 8px 24px -8px rgba(15,23,42,0.10)) with the 1px --cd-border kept as its edge. The sticky table header was re-grounded to #ffffff to match its new scroll surface. box-shadow count in DashboardLight went 0 → 1, and it is --cd-elev-2. A comment on <main> records why light diverges from dark (lightness on dark, shadow on light — one mechanism per theme).",
    "major · coral stopped meaning 'a price'. All 19 price pills in Main.dc.html moved off --cd-accent-fill onto --cd-art-scrim (rgba(7,8,11,0.55)) with the amount kept in white `data` type — the recipe §5 already rates at 7.63:1 against the worst palette stop. Applied identically to Landing390.dc.html (19) and HeroA.dc.html (1), which are the same page at other widths, and to the two campaign-tile pills in tools/shared-snippets.html so the canonical markup does not re-seed the old recipe in Phase 2. Coral-as-fill now survives on exactly three elements per landing artboard (nav CTA, hero CTA, closing band) and two on HeroA, and the pill is legible on the coral-ember tiles (Casa Duarte $500, Terrapin $350, and the two art-strip tiles).",
    "major · Tokens --cd-radius-1 specimen re-shot honestly — the price-pill chip there was a bare #d64131 swatch documenting a recipe that no longer ships; it is now the scrim pill rendered on the coral-ember gradient (#ff6a58 → #c22514), i.e. the exact palette an accent-fill pill disappeared into, with the caption updated to say so.",
    "major · Dashboard.dc.html and DashboardLight.dc.html unboxed. 'Needs you' is now a ruled list: top hairline under the h2, no outer border, no fill, --cd-radius-0, rows at 16px 0 with a 1px rule each. 'Campaigns' runs full-bleed in the 1112px main column with no wrapper border, no fill, --cd-radius-0, the sticky header row grounded on the page canvas over a bottom hairline, 1px rules on all three body rows (the last row gained one so the table closes), and the first/last cells' outer horizontal padding zeroed so the columns hang on the page measure — the same grammar as the landing's agency table. The pipeline panel was unboxed the same way, which is what leaves the money strip as the single object on the page, as the fix asked. Verified: exactly one bordered, filled, radius-10 sibling remains per dashboard artboard.",
    "major · the Tokens pairing test now compares settings that ship. The 17px Archivo 'wdth' 105 / 'wght' 400 specimen (a weight nothing in §3 uses) was replaced by the two adjacencies that actually collide, both taken from /brand at their real settings: h2 Archivo 'wdth' 100 / 600 at 22px stacked 4px above h3 Schibsted Grotesk 600 at 17px (\"Needs you\" over \"Marcus Ilagan\"), and `data` Archivo 'wdth' 88 / 500 tabular at 15px set inline inside a Schibsted 400 body sentence (\"Accepting holds $425.00 · $361.25 to Marcus\"). The lead paragraph was rewritten to say why those two are the whole test.",
    "gate re-run after editing, over all seven .dc.html files plus tools/shared-snippets.html: backdrop-filter 0 · radial-gradient 0 · blur( 0 · authored border-radius 18–40px 0 · text-transform uppercase 0 · tracked-out letter-spacing 0 · emoji 0 · arrows (→ ← ↦) 0 · text-align:center 0 · lone 'wdth'/'wght' declarations 0 · eyebrow 0 · 01/02/03 chips 0 · shimmer 0 · IntersectionObserver/scroll-behavior 0 · extra <script> tags 0 (each file keeps exactly one ./support.js). The only 18–40px radii in the tree are 19.2px on cover-art stripe decor spans (height × 0.16 / 2, generated, exempt by §9.5) and the only 999px radii are avatars, initials discs and 6px status dots. box-shadow appears on one element (DashboardLight money strip, --cd-elev-2) plus the Tokens elevation specimens. Tag balance verified on every file; canvas.json parses. Money figures re-checked against the §10 fixture and are unchanged and reconciling."
  ],
  "skipped": [
    {
      "claim": "blocker (findings 1 and 3) · set Landing390's canvas.json h to 10000 and re-flow SignIn/Tokens below it",
      "why": "Already true when this pass began. canvas.json was last written at 15:51, after the findings were taken at 12:40: Landing390 is declared h 10000 (matching its own min-height: 10000px, which is the hard floor above the 9,928px natural content), and SignIn/Tokens sit at y 16680 — a 120px gutter below Landing390's real 16560 bottom, with no intersection. I re-verified the whole layout for overlaps and gaps rather than re-applying. The still-live half of finding 1 — re-deriving every h from current min-heights and right-sizing the two dashboard frames — is in `applied`."
    },
    {
      "claim": "major (finding 7, second half) · raise dashboard h1 to Archivo 'wdth' 112 and h2 to 'wdth' 105",
      "why": "It contradicts a binding spec rather than fixing an artboard. 01-design-brief §3 is named binding in my instructions and fixes h1 at Archivo 'wdth' 105 and h2 at 'wdth' 100; Tokens.dc.html prints that scale as the §3 table. Changing the artboards alone would make them stop previewing the spec, and changing them plus the printed table would make the token sheet misreport the brief the owner is approving against. The reviewer's argument (that at 100–105 Archivo reads as 'a slightly wider UI heading' and the shopfront character never reaches the workspace) is a fair one, but it is an amendment to 01-design-brief §3 that should be made in that document and then flowed into the artboards — not a targeted artboard correction. Flagging it for the owner: if §3 moves to h1 112 / h2 105, six lines change (h1 and h2 in Dashboard.dc.html and DashboardLight.dc.html, and the two scale rows plus the new pairing specimen in Tokens.dc.html)."
    }
  ],
  "canvasAdjusted": true,
  "guessList": [
    "I could not render anything. The browser pane refused every file:// URL I tried (both the scratchpad and a temporary file inside the mockups folder), so no artboard was measured or eyeballed in this pass. Every height figure below is arithmetic on the markup, not a measurement.",
    "Dashboard content height ≈1230px is my own sum of sections and gaps (32 padding + 48 banner + 32 + 63 header + 32 + 133 money strip + 32 + 178 Needs you + 32 + 295 campaigns + 32 + 288 pipeline + 32). I set min-height and canvas h to 1400 rather than the fix's ~1300 to keep slack I could not verify. If someone can render it, confirm before trusting 1400.",
    "Lowering Dashboard/DashboardLight below their previous values conflicts with my standing instruction to never lower a frame height. I judged it safe only because I lowered the artboard's own min-height in the same edit, so the frame is not clipping content the artboard still paints — which is the defect the same reviewer raised against Landing390. If that reading is wrong, revert both numbers to 1900 and the artboards are unharmed.",
    "Tokens.dc.html has min-height 900px and flows far past it; its true height is unmeasured, and 11200 was inherited from a run I cannot verify. I raised it to 11600 on the 'raise if in doubt' rule, not on evidence.",
    "Finding 4's phrase 'so the main column is the lit surface' is ambiguous. Dropping the sidebar to #f5f7fb alone would have made rail and column the identical fill and destroyed the structural division entirely, so I read it as: rail = --cd-bg, main column = --cd-bg-element (#ffffff), panels = level 2 on top. That is the reading that makes the fix work and matches the brief's own 'shadow carries elevation in light' mechanism, but it does break the §10 promise that DashboardLight is 'byte-for-byte the same markup' as the dark board — deliberately, since finding 4 asks for a recipe of its own. The owner should be told the two dashboard artboards are no longer a pure token swap.",
    "Findings 5 and 6 both partly contradict the binding brief and I applied them anyway. §5 specifies the price pill as --cd-accent-fill + --cd-on-accent and says it does not need the scrim; §7 does not describe the pipeline as unboxed. I applied the pill change because §1's 'the only saturated colour is real campaign artwork' and gate 20's 'one saturated coral surface per page' are also binding and 19 coral pills violate them, and because the coral-ember collision is real. I unboxed the pipeline because finding 6's own fix says the result should leave the money strip as the single object. Both are arguably a step past 'targeted'.",
    "I edited tools/shared-snippets.html (brand lockups, price pills, and the note that said artboards use Option A) although no finding names that file. It is the canonical markup Phase 2 pastes from, and leaving it carrying the old mark and the accent-fill pill would have re-seeded both defects in the build. Say so if that overreach is unwanted; the artboards themselves are unaffected either way.",
    "The redrawn mark's legibility at 16px is calculated, not seen. Teeth of 5.33 × 2.5 units scale to 3.3 × 1.5px at a 16px favicon and the two rules to 6.2 × 1.35px and 3.3 × 1.35px. That should hold, but nobody has looked at it, and the 512px and off-tile (accent, text) variants are equally unviewed.",
    "I did not touch the fee percentage, any money figure, or any CTA label; every amount still comes from §10 and every CTA still renders in invite mode with the open-mode label annotated beside it. That was verified by grep, not by reading every string in context."
  ]
}
```

---

## Second look (read-only, after the fix pass) — 2026-09-08

Two real defects, both fixed by the orchestrator before the canvas was re-saved:

1. `SignIn.dc.html` — the Clerk footer link still read "Don't have an account? Sign up" → `/sign-up`, a live open-mode CTA on an invite-mode artboard. Now "Request access" → `/waitlist` with the open-mode label as an annotation, matching the left panel.
2. `Tokens.dc.html` — the body-type specimen used "$500.00 → $425.00", a figure outside the fixture that reused Marcus Ilagan's $425.00 gross as a net. Now "$400.00 → $340.00".

Minor applied: the "never abbreviated" money specimen now uses the fixture's $950.00. Everything else held: one `support.js` line per file, zero unclosed tags, every `font-variation-settings` sets both axes, all money reconciles, one brand mark, canvas frames non-overlapping with root heights ≤ frame heights, DashboardLight structurally identical to Dashboard apart from colour, the `<main>` ground and the one permitted shadow.

Could not verify without a browser: rendered fit inside `overflow: hidden` roots at exactly frame height (Main 6400, Landing390 10000), real font loading, and rendered contrast.

---

## Revision round — light variants and the variable rate (2026-09-08 evening)

Jackson: "I like the vibe, can you make this light mode, and I'm not sure I like the $400 mark" → clarified as: the rate varies by brand and by what is being asked for, so the page should not present one number as the price. He chose light artboards to compare rather than flipping the plan's direction.

**The rate reframe** (`Main`, `HeroA`, `Landing390`). The hero lead carried `$400` four times and the cost band repeated it, so the page read as a price list.
- Hero lead now carries no amount: "Posting a brief is free. Creators near you apply with a pitch and their own rate. Accepting holds that rate on your card; approving charges it. Our 15% comes out of that rate, never on top."
- The cost band's single worked example became a ruled table over three real briefs — $250 / $400 / $900 — with the platform fee and the creator's net beside each, so the fee visibly scales while the percentage does not. Desktop only; `Landing390` keeps three columns.
- The slip is captioned as one application on a brief with a second slot open, where Marcus Ilagan asked $425.00 against Ana Reyes's accepted $400.00 — which also closes the coherence gap the first fidelity review raised.
- The FAQ keeps one worked example at $400/$340 deliberately: it answers "what does it cost" and a worked example is the right form there.

**Light variants.** `MainLight.dc.html` and `SignInLight.dc.html`, generated from the corrected dark files. Structurally identical to their twins — with colours normalised, `MainLight` differs from `Main` by one added box-shadow and `SignInLight` from `SignIn` by two. Elevation is carried by shadow rather than by a lighter fill, because light caps at white. Cover art is byte-identical; the brand mark keeps `#ff503d`; the art scrim is unchanged in both themes. **These two explore extending light past the dashboard, which `01-design-brief.md` §2 currently forbids on marketing and auth** — the canvas carries a sticky note saying so, and the plan is not amended unless Jackson picks light.

**Reviewer findings applied by the orchestrator.** `a:hover` no longer recolours to a surface token (it was 4.22:1 light / 4.44:1 dark); hover now only reveals the underline, in all nine artboards. The footer locality label moved off `--cd-text-faint`, a non-text token, in dark to match the light file. `SignInLight`'s inner annotation card is stepped by fill (`#eef2f8`) instead of repeating the panel's shadow, so two levels stay distinguishable. Frames re-derived from measurement: landing 6480 (content 6436, identical in both themes), mobile 10160 (content 10104), light sign-in 900 exactly.
