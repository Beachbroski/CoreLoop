// Guards against @creatordocks/shared's Zod enums silently drifting from the
// Prisma schema (packages/shared cannot depend on @prisma/client — see
// docs/platform-split/01-shared-foundation.md — so this comparison can only
// happen here, web-side).
import { describe, expect, it } from 'vitest'
import { Role, CampaignStatus, ApplicationStatus, SubmissionStatus, PayoutStatus } from '@prisma/client'
import {
  RoleSchema,
  CampaignStatusSchema,
  ApplicationStatusSchema,
  SubmissionStatusSchema,
  PayoutStatusSchema,
} from '@creatordocks/shared'

function expectSameValues(prismaEnum: Record<string, string>, zodEnum: { options: readonly string[] }) {
  expect(new Set(zodEnum.options)).toEqual(new Set(Object.values(prismaEnum)))
}

describe('shared enums match prisma schema', () => {
  it('Role', () => expectSameValues(Role, RoleSchema))
  it('CampaignStatus', () => expectSameValues(CampaignStatus, CampaignStatusSchema))
  it('ApplicationStatus', () => expectSameValues(ApplicationStatus, ApplicationStatusSchema))
  it('SubmissionStatus', () => expectSameValues(SubmissionStatus, SubmissionStatusSchema))
  it('PayoutStatus', () => expectSameValues(PayoutStatus, PayoutStatusSchema))
})
