import { formatPercent, type FunnelStep } from '@/lib/brand-metrics'

interface FunnelBarsProps {
  steps: FunnelStep[]
  compact?: boolean
}

function stepCaption(step: FunnelStep, index: number): string {
  if (index === 0) return step.hint
  if (step.conversionFromPrevious === null) return step.hint
  const previous = step.previousLabel?.toLowerCase() ?? 'the step before'
  return `${formatPercent(step.conversionFromPrevious)} of ${previous} · ${formatPercent(step.shareOfTop)} of all applications`
}

export function FunnelBars({ steps, compact = false }: FunnelBarsProps) {
  return (
    <div className="subtle-grid" style={{ gap: compact ? 12 : 16 }}>
      {steps.map((step, index) => (
        <div key={step.key}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
              marginBottom: 5,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: compact ? '.92rem' : '1rem' }}>{step.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {step.count}
              {compact && index > 0 && (
                <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}> · {formatPercent(step.shareOfTop)}</span>
              )}
            </span>
          </div>
          <div className="admin-breakdown-track">
            <div className="admin-breakdown-fill" style={{ width: `${(step.shareOfTop ?? 0) * 100}%` }} />
          </div>
          {!compact && (
            <p style={{ margin: '6px 0 0', color: 'var(--text-faint)', fontSize: '.82rem' }}>
              {stepCaption(step, index)}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
