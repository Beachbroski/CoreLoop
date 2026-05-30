import { getCurrentAppUser } from '@/lib/current-app-user'

export async function requireAdminApiUser() {
  const { userId, user } = await getCurrentAppUser()

  if (!userId) {
    return { user: null, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!user || user.role !== 'ADMIN') {
    return { user: null, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, response: null }
}
