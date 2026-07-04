import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { resolvePostLoginPath } from '@/lib/post-login'

export const dynamic = 'force-dynamic'

export default async function PostLoginPage() {
  const { userId, user } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  redirect(resolvePostLoginPath(user))
}
