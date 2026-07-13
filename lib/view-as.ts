import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import prisma from './prisma'
import type { User } from '@prisma/client'

export type DashboardRole = 'BRAND' | 'CREATOR'

export type DashboardViewer = {
  viewer: User
  isAdminViewing: boolean
  readOnly: boolean
  viewAsNotFound: boolean
}

// Resolves whose data a /brand or /creator page should render.
//
// - A real BRAND/CREATOR account viewing their own dashboard: viewer = self, read/write as normal.
// - An ADMIN with a valid ?viewAs=<userId> for a matching-role account: viewer = that account, read-only.
// - An ADMIN with no/invalid ?viewAs: falls back to the admin's own (empty) account, read-only.
//
// Callers must omit all mutation-triggering UI when `readOnly` is true — write-side API routes
// already reject non-owner roles independently, this only controls what renders.
export async function resolveDashboardViewer(role: DashboardRole, viewAsId?: string): Promise<DashboardViewer> {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const actingUser = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!actingUser) redirect('/onboarding')

  const isAdmin = actingUser.role === 'ADMIN'

  if (isAdmin && viewAsId) {
    const target = await prisma.user.findUnique({ where: { id: viewAsId } })
    if (target && target.role === role) {
      return { viewer: target, isAdminViewing: true, readOnly: true, viewAsNotFound: false }
    }
    return { viewer: actingUser, isAdminViewing: true, readOnly: true, viewAsNotFound: true }
  }

  return { viewer: actingUser, isAdminViewing: isAdmin, readOnly: isAdmin, viewAsNotFound: false }
}
