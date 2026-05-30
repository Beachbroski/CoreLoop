import { getCurrentAppUser } from '@/lib/current-app-user'
import { isAllowedAdminUser } from '@/lib/admin-config'

type CurrentAppUser = NonNullable<Awaited<ReturnType<typeof getCurrentAppUser>>['user']>
type AdminApiGate =
  | { user: CurrentAppUser; response: null }
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
