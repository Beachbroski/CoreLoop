import { formatPercent } from '@/lib/brand-metrics'

export interface BreakdownRow {
  label: string
  count: number
  share: number | null
  tone?: string
}

interface BreakdownListProps {
  title: string
  rows: BreakdownRow[]
  emptyLabel: string
}

export function BreakdownList({ title, rows, emptyLabel }: BreakdownListProps) {
  const hasData = rows.some(row => row.count > 0)

  return (
    <div>
      <p className="sidebar-label" style={{ margin: '0 0 12px' }}>{title}</p>
      {!hasData ? (
        <p className="page-copy" style={{ margin: 0, fontSize: '.9rem' }}>{emptyLabel}</p>
      ) : (
        <div className="subtle-grid" style={{ gap: 10 }}>
          {rows.map(row => (
            <div key={row.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', marginBottom: 4 }}>
                <span>{row.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-soft)' }}>
                  {row.count} · {formatPercent(row.share)}
                </span>
              </div>
              <div className="admin-breakdown-track">
                <div
                  className="admin-breakdown-fill"
                  style={{ width: `${(row.share ?? 0) * 100}%`, background: row.tone ?? 'var(--accent)' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
