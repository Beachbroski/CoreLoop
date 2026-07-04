import { getCurrentAppUser } from '@/lib/current-app-user'
import { isAllowedAdminUser, isTesterEmailAllowed } from '@/lib/admin-config'

type CurrentAppUser = NonNullable<Awaited<ReturnType<typeof getCurrentAppUser>>['user']>
type AdminApiGate =
  | { user: CurrentAppUser; response: null }
  | { user: null; response: Response }
type TesterApiGate =
  | { user: CurrentAppUser | null; response: null }
  | { user: null; response: Response }

export async function requireAdminApiUser(): Promise<AdminApiGate> {
  const { userId, user } = await getCurrentAppUser()

  if (!userId) {
    return { user: null, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!user || !isAllowedAdminUser(user)) {
    return { user: null, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, response: null }
}

// Marketplace access while in waitlist mode: any signed-in, tester-allowlisted user.
// The user row may still be null (pre-onboarding); handlers 404/403 on their own role checks.
export async function requireTesterApiUser(): Promise<TesterApiGate> {
  const { userId, user, email } = await getCurrentAppUser()

  if (!userId) {
    return { user: null, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!isTesterEmailAllowed(email)) {
    return { user: null, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, response: null }
}
