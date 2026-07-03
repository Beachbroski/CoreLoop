'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, type ComponentProps } from 'react'

type PublicWaitlistLinkProps = Omit<ComponentProps<typeof Link>, 'href'>

function WaitlistLinkWithParams(props: PublicWaitlistLinkProps) {
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const waitlistHref = queryString ? `/waitlist?${queryString}` : '/waitlist'

  return <Link {...props} data-public-waitlist-link="true" href={waitlistHref} />
}

export function PublicWaitlistLink(props: PublicWaitlistLinkProps) {
  return (
    <Suspense fallback={<Link {...props} data-public-waitlist-link="true" href="/waitlist" />}>
      <WaitlistLinkWithParams {...props} />
    </Suspense>
  )
}
