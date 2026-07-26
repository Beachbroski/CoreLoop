# W6 — Push Notifications & Media Uploads

**Goal:** Creators hear about status changes without opening the app, and submission media flows through the existing UploadThing pipeline from mobile.

## Part 1 — Push notifications

### Architecture
- **Expo Push Service** (free, no APNs key juggling in v1; EAS handles credentials). Server sends via Expo push API; Expo delivers via APNs.
- New Prisma model `Device`: `id, userId → User, expoPushToken (unique), platform, lastSeenAt, createdAt`. Multiple devices per user supported.
- Server helper `lib/push.ts`: send-by-userId, chunked batching per Expo API limits, receipt checking, **prune tokens on `DeviceNotRegistered`** receipts.

### Notification triggers (hook into existing transition points — same places `lib/email.ts` is called today)
| Event | Notification | Deep link |
|---|---|---|
| Application ACCEPTED / REJECTED | "Your application to <campaign> was accepted 🎉" / softer rejection copy | activity/applications/[id] |
| Submission APPROVED / REJECTED (with note) | "Your submission was approved" / "Changes requested" | activity/submissions/[id] |
| Payout PAID / FAILED | "You've been paid $X" / "Action needed on your payout" | earnings |
| New matching campaign (v1.1, behind preference) | "New <niche> campaign: <title>" | discover/[id] |

Email keeps firing for all events during transition (creators may not have the app yet); revisit email-vs-push matrix at sunset (W8).

### Tasks
- **W6-1:** `Device` model + migration; `POST /api/v1/devices` (upsert by token, re-associate if token moves accounts — a device that signs into a second account must stop notifying the first) + `DELETE /api/v1/devices/:token` on sign-out.
- **W6-2:** `lib/push.ts` sender with batching, receipts, token pruning. Unit-tested with mocked Expo API.
- **W6-3:** Wire triggers into existing status-change code paths (application review, submission review, payout webhooks). Notification send is fire-and-forget with logging — a push failure must never fail the business operation.
- **W6-4 (app, with W3-11):** permission prompt post-first-action; foreground notification handling; tap → deep-link routing; preferences toggle (per-category opt-out stored server-side on Device or User).

### Security
- Push token registration requires auth; tokens stored server-side only, never in any API response.
- **Notification payloads contain no sensitive specifics** — Expo relay + lock screens see them. "You've been paid" + deep link; the app fetches details over authed API. No amounts in payload unless Jackson explicitly opts in (lock-screen exposure).
- Deep links from notifications go through the same untrusted-params validation as any deep link (W5 checklist).

## Part 2 — Media uploads (submission content + avatars)

### Architecture
- Keep **UploadThing** (already integrated server-side; has an Expo package). Mobile requests a presigned upload from our backend → uploads directly to UploadThing → submits the resulting file key/URL with the submission.
- New UploadThing file routes for mobile: `submissionMedia` (video+image, size caps per plan limits, count cap per submission) and `avatar` (image, small cap) — each with authenticated middleware resolving the creator, mirroring existing web route config.

### Tasks
- **W6-5:** Mobile file routes in `app/api/uploadthing` config: auth via the Bearer path (verify UploadThing middleware can consume the mobile guard — if it's cookie-assuming, adapt), per-route type/size/count limits, uploader userId recorded in route metadata.
- **W6-6 (app, with W3-8):** `expo-image-picker` (photo library; camera optional v1) → upload with progress → attach to submission. Client-side pre-compression for images (`expo-image-manipulator`) to respect caps; friendly failure states (network drop mid-upload, over-size).
- **W6-7:** Submission payload accepts **only** file keys/URLs belonging to our UploadThing app and uploaded by the submitting creator (server-side check via route metadata) — never arbitrary URLs. External links (e.g. a TikTok URL) are a separate validated `externalUrl` field: https-only, allow-listed host patterns, length-capped.
- **W6-8:** Orphan cleanup: uploaded-but-never-attached files deleted after TTL (scheduled job — Vercel cron); deletion of media when its submission is deleted / account deleted (ties to W2-10).

### Security
- Upload authorization at request time (authed creator), type/size enforced server-side by UploadThing config — client-side checks are UX, not security.
- File type validated by MIME *and* extension config; no user-controlled content ever served from our origin (UploadThing CDN handles serving — keeps XSS-via-upload off our domain).
- Media URLs in v1 responses only for content the requester is authorized to see (own submissions; brand sees them web-side as today).

## Acceptance criteria
- [ ] Status-change events reliably produce push on a real device (TestFlight build), tap lands on the right screen.
- [ ] Token lifecycle correct: sign-out and account-switch stop notifications to the old identity; dead tokens pruned via receipts.
- [ ] Upload → attach → brand-reviews-on-web loop works end-to-end in staging.
- [ ] Arbitrary-URL and foreign-file-key submission attempts rejected by server tests (W6-7).
- [ ] Orphaned media cleanup job verified.
