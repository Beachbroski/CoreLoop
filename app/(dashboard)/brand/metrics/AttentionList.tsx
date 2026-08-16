import Link from 'next/link'
import type { AttentionMetrics } from '@/lib/brand-metrics'
import { formatCents } from '@/lib/utils'

interface AttentionListProps {
  attention: AttentionMetrics
}

export function AttentionList({ attention }: AttentionListProps) {
  const items = [
    {
      key: 'applications',
      count: attention.pendingApplications,
      label: 'Pitches awaiting your decision',
      href: '/brand/applications',
      linkLabel: 'Review pitches',
      tone: 'var(--warning)',
    },
    {
      key: 'submissions',
      count: attention.submissionsAwaitingReview,
      label: 'Submissions awaiting review',
      href: '/brand/submissions',
      linkLabel: 'Review content',
      tone: 'var(--warning)',
    },
    {
      key: 'payouts',
      count: attention.failedPayouts,
      label: `Failed payouts · ${formatCents(attention.failedPayoutCents)} never reached the creator`,
      href: null,
      linkLabel: null,
      tone: 'var(--danger)',
    },
  ].filter(item => item.count > 0)

  if (items.length === 0) {
    return (
      <p className="page-copy" style={{ margin: 0 }}>
        Nothing is waiting on you right now. Every pitch has a decision, every submission has a review, and no payout
        has failed.
      </p>
    )
  }

  return (
    <div>
      {items.map(item => (
        <div key={item.key} className="list-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: item.tone, fontVariantNumeric: 'tabular-nums' }}>
              {item.count}
            </span>
            <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.94rem' }}>{item.label}</p>
          </div>
          {item.href && <Link href={item.href} className="apple-link">{item.linkLabel}</Link>}
        </div>
      ))}
      {attention.revisionsRequested > 0 && (
        <p style={{ margin: '14px 0 0', color: 'var(--text-faint)', fontSize: '.82rem' }}>
          {attention.revisionsRequested} submission{attention.revisionsRequested === 1 ? ' is' : 's are'} back with
          creators for revisions.
        </p>
      )}
    </div>
  )
}
