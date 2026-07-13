import Link from 'next/link'
import { resolveDashboardViewer } from '@/lib/view-as'
import { NewCampaignForm } from './NewCampaignForm'

export default async function NewCampaignPage() {
  const { readOnly } = await resolveDashboardViewer('BRAND')

  if (readOnly) {
    return (
      <div className="empty-state">
        <div className="empty-icon" />
        <h3 style={{ margin: '0 0 8px' }}>Not available in read-only admin view</h3>
        <p className="page-copy" style={{ margin: '0 0 18px' }}>
          Campaign creation is disabled while viewing as an admin. Pick an account from the internal users list to view
          their campaigns instead.
        </p>
        <Link href="/brand" className="apple-btn">Back to dashboard</Link>
      </div>
    )
  }

  return <NewCampaignForm />
}
