'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AdminPreviewBannerContent() {
  const searchParams = useSearchParams()
  if (searchParams.get('preview') !== 'admin') return null

  return (
    <div className="admin-preview-banner">
      <span>Admin preview — viewing this page the way a visitor sees it.</span>
      <Link href="/internal/waitlist" className="admin-preview-banner-link">Back to Ops</Link>
    </div>
  )
}

export function AdminPreviewBanner() {
  return (
    <Suspense fallback={null}>
      <AdminPreviewBannerContent />
    </Suspense>
  )
}
