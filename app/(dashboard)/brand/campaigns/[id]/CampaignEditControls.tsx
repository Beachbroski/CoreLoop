'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EditableCampaign {
  id: string
  status: string
  title: string
  description: string
  objective: string | null
  deliverables: string | null
  targetAudience: string | null
  callToAction: string | null
  creatorRequirements: string | null
  usageRights: string | null
}

interface BriefForm {
  title: string
  description: string
  objective: string
  deliverables: string
  targetAudience: string
  callToAction: string
  creatorRequirements: string
  usageRights: string
}

function toForm(campaign: EditableCampaign): BriefForm {
  return {
    title: campaign.title,
    description: campaign.description,
    objective: campaign.objective ?? '',
    deliverables: campaign.deliverables ?? '',
    targetAudience: campaign.targetAudience ?? '',
    callToAction: campaign.callToAction ?? '',
    creatorRequirements: campaign.creatorRequirements ?? '',
    usageRights: campaign.usageRights ?? '',
  }
}

export function CampaignEditControls({ campaign }: { campaign: EditableCampaign }) {
  const router = useRouter()

  // The PATCH endpoint only ever accepts `status` values of DRAFT/ACTIVE/CANCELLED
  // (IN_PROGRESS/COMPLETE are set automatically elsewhere), so cancelling only makes
  // sense while the campaign hasn't already reached a terminal state. Editing the brief
  // is scoped to DRAFT/ACTIVE, since once a campaign is IN_PROGRESS creators have already
  // committed against the existing brief.
  const canEdit = campaign.status === 'DRAFT' || campaign.status === 'ACTIVE'
  const canCancel = campaign.status === 'DRAFT' || campaign.status === 'ACTIVE' || campaign.status === 'IN_PROGRESS'

  const [mode, setMode] = useState<'idle' | 'editing'>('idle')
  const [form, setForm] = useState<BriefForm>(() => toForm(campaign))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  function updateField<K extends keyof BriefForm>(key: K, value: BriefForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          objective: form.objective,
          deliverables: form.deliverables,
          targetAudience: form.targetAudience,
          callToAction: form.callToAction,
          creatorRequirements: form.creatorRequirements,
          usageRights: form.usageRights,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update campaign')
      setMode('idle')
      router.refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelCampaign() {
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to cancel campaign')
      setConfirmCancel(false)
      router.refresh()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCancelling(false)
    }
  }

  if (!canEdit && !canCancel) return null

  if (mode === 'editing') {
    return (
      <form onSubmit={handleSave} className="subtle-grid" style={{ gap: 18 }}>
        {saveError && <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--danger)' }}>{saveError}</p>}

        <div>
          <label className="field-label" htmlFor="edit-title">Campaign title</label>
          <input
            id="edit-title"
            type="text"
            required
            minLength={5}
            maxLength={100}
            className="apple-input"
            value={form.title}
            onChange={e => updateField('title', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="edit-description">Description</label>
          <textarea
            id="edit-description"
            required
            minLength={20}
            maxLength={2000}
            className="apple-textarea"
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="edit-objective">Primary goal</label>
          <input
            id="edit-objective"
            type="text"
            maxLength={240}
            className="apple-input"
            value={form.objective}
            onChange={e => updateField('objective', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="edit-deliverables">Deliverables</label>
          <textarea
            id="edit-deliverables"
            maxLength={1200}
            className="apple-textarea"
            value={form.deliverables}
            onChange={e => updateField('deliverables', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="edit-targetAudience">Target audience</label>
          <input
            id="edit-targetAudience"
            type="text"
            maxLength={240}
            className="apple-input"
            value={form.targetAudience}
            onChange={e => updateField('targetAudience', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="edit-callToAction">Call to action</label>
          <input
            id="edit-callToAction"
            type="text"
            maxLength={240}
            className="apple-input"
            value={form.callToAction}
            onChange={e => updateField('callToAction', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="edit-creatorRequirements">Creator requirements</label>
          <textarea
            id="edit-creatorRequirements"
            maxLength={1200}
            className="apple-textarea"
            value={form.creatorRequirements}
            onChange={e => updateField('creatorRequirements', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="edit-usageRights">Usage rights</label>
          <input
            id="edit-usageRights"
            type="text"
            maxLength={240}
            className="apple-input"
            value={form.usageRights}
            onChange={e => updateField('usageRights', e.target.value)}
          />
        </div>

        <div className="chip-row">
          <button type="submit" disabled={saving} className="apple-btn" style={{ padding: '10px 20px', fontSize: 15 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => { setForm(toForm(campaign)); setSaveError(null); setMode('idle') }}
            disabled={saving}
            className="apple-btn-ghost"
            style={{ padding: '10px 20px', fontSize: 15 }}
          >
            Discard
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="chip-row">
      {canEdit && (
        <button
          type="button"
          onClick={() => setMode('editing')}
          disabled={cancelling}
          className="apple-btn-ghost"
          style={{ padding: '10px 20px', fontSize: 15 }}
        >
          Edit brief
        </button>
      )}

      {canCancel && (
        confirmCancel ? (
          <>
            <span style={{ fontSize: 14, color: 'var(--danger)', alignSelf: 'center' }}>Are you sure?</span>
            <button
              type="button"
              onClick={handleCancelCampaign}
              disabled={cancelling}
              className="apple-btn-ghost"
              style={{ padding: '10px 20px', fontSize: 15, color: 'var(--danger)', borderColor: 'rgba(225, 29, 72, 0.28)' }}
            >
              {cancelling ? 'Cancelling…' : 'Confirm cancel'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              disabled={cancelling}
              className="apple-btn-ghost"
              style={{ padding: '10px 20px', fontSize: 15 }}
            >
              Keep campaign
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            disabled={cancelling}
            className="apple-btn-ghost"
            style={{ padding: '10px 20px', fontSize: 15, color: 'var(--danger)', borderColor: 'rgba(225, 29, 72, 0.28)' }}
          >
            Cancel campaign
          </button>
        )
      )}

      {cancelError && <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--danger)' }}>{cancelError}</p>}
    </div>
  )
}
