'use client'

import { useState } from 'react'

const NICHES = ['Fashion', 'Beauty', 'Fitness', 'Gaming', 'Food', 'Tech', 'Lifestyle', 'Finance', 'Other']
const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'X', 'Discord']
const USAGE_RIGHTS = ['Organic only', 'Organic + paid ads', 'Whitelisting / Spark Ads', 'Need to discuss']

export default function NewCampaignPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [platforms, setPlatforms] = useState<string[]>([])

  function togglePlatform(platform: string) {
    setPlatforms(prev => prev.includes(platform) ? prev.filter(item => item !== platform) : [...prev, platform])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.currentTarget
    const data = new FormData(form)
    const budgetCents = Math.round(parseFloat(data.get('budget') as string) * 100)
    const deadline = new Date(data.get('deadline') as string).toISOString()

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.get('title'),
          description: data.get('description'),
          objective: data.get('objective'),
          deliverables: data.get('deliverables'),
          targetAudience: data.get('targetAudience'),
          creatorRequirements: data.get('creatorRequirements'),
          callToAction: data.get('callToAction'),
          usageRights: data.get('usageRights'),
          creatorsNeeded: data.get('creatorsNeeded') ? Number(data.get('creatorsNeeded')) : undefined,
          budget: budgetCents,
          deadline,
          niche: data.get('niche'),
          platforms,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create campaign')
      window.location.href = `/brand/campaigns/${json.data.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="subtle-grid" style={{ gap: 26 }}>
      <div>
        <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Campaign builder
        </p>
        <h1 className="page-title" style={{ marginBottom: 10 }}>Create a campaign creators want to answer.</h1>
        <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>
          A strong brief feels specific, paid, and easy to act on. Give creators enough context to imagine the work.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="subtle-grid two-col">
        <section className="dashboard-panel" style={{ gap: 22 }}>
          {error && (
            <div className="banner-danger">
              <p style={{ margin: 0, color: 'var(--danger)', fontSize: '.95rem' }}>{error}</p>
            </div>
          )}

          <div>
            <label className="field-label" htmlFor="title">Campaign title</label>
            <input
              id="title"
              name="title"
              type="text"
              required
              minLength={5}
              maxLength={100}
              placeholder="Summer collection launch"
              className="apple-input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              required
              minLength={20}
              maxLength={2000}
              placeholder="Describe the campaign, the content style, the deliverables, and what a great fit looks like."
              className="apple-textarea"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="objective">Primary goal</label>
            <input
              id="objective"
              name="objective"
              type="text"
              maxLength={240}
              placeholder="Drive product awareness, collect UGC, or support a launch moment."
              className="apple-input"
            />
          </div>

          <div className="subtle-grid two-col">
            <div>
              <label className="field-label" htmlFor="budget">Budget (USD)</label>
              <input
                id="budget"
                name="budget"
                type="number"
                required
                min={5}
                step={0.01}
                placeholder="500"
                className="apple-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="creatorsNeeded">Creators needed</label>
              <input
                id="creatorsNeeded"
                name="creatorsNeeded"
                type="number"
                min={1}
                max={100}
                step={1}
                placeholder="3"
                className="apple-input"
              />
            </div>
          </div>

          <div className="subtle-grid two-col">
            <div>
              <label className="field-label" htmlFor="deadline">Deadline</label>
              <input id="deadline" name="deadline" type="date" required className="apple-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="niche">Niche</label>
              <select id="niche" name="niche" required className="apple-select">
                <option value="">Select a niche</option>
                {NICHES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="deliverables">Deliverables</label>
            <textarea
              id="deliverables"
              name="deliverables"
              maxLength={1200}
              placeholder="1 TikTok video, 3 story frames, raw files, hooks to test, or any review notes you expect."
              className="apple-textarea"
            />
          </div>
        </section>

        <section className="dashboard-panel" style={{ gap: 22 }}>
          <div>
            <h2 style={{ margin: '0 0 8px' }}>Distribution plan</h2>
            <p style={{ margin: 0, color: 'var(--text-soft)' }}>
              Choose the platforms you want the creator to publish on, then add the missing context that helps better-fit creators apply.
            </p>
          </div>

          <div>
            <p className="field-label" style={{ marginBottom: 10 }}>Platforms</p>
            <div className="chip-row">
              {PLATFORMS.map(item => {
                const selected = platforms.includes(item)
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => togglePlatform(item)}
                    className={selected ? 'filter-chip filter-chip-active' : 'ghost-chip'}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
            {platforms.length === 0 && (
              <p style={{ margin: '10px 0 0', color: 'var(--text-soft)', fontSize: '.9rem' }}>
                Pick at least one platform.
              </p>
            )}
          </div>

          <div>
            <label className="field-label" htmlFor="targetAudience">Target audience</label>
            <input
              id="targetAudience"
              name="targetAudience"
              type="text"
              maxLength={240}
              placeholder="College students, skincare-first shoppers, new moms, or remote founders."
              className="apple-input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="callToAction">Call to action</label>
            <input
              id="callToAction"
              name="callToAction"
              type="text"
              maxLength={240}
              placeholder="Drive product page visits, free trial signups, waitlist joins, or code redemptions."
              className="apple-input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="creatorRequirements">Creator requirements</label>
            <textarea
              id="creatorRequirements"
              name="creatorRequirements"
              maxLength={1200}
              placeholder="Share any audience, content-style, location, experience, or follower-range requirements."
              className="apple-textarea"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="usageRights">Usage rights</label>
            <select id="usageRights" name="usageRights" className="apple-select">
              <option value="">Select usage terms</option>
              {USAGE_RIGHTS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="glass-card" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <p style={{ margin: '0 0 10px', fontWeight: 600 }}>Brief checklist</p>
            <div className="subtle-grid" style={{ gap: 10 }}>
              {[
                'A clear outcome so creators know what success looks like',
                'Specific deliverables that remove guesswork before they apply',
                'Audience, CTA, and usage details that make the brief feel professionally funded',
              ].map(item => (
                <div key={item} className="pill" style={{ justifyContent: 'flex-start' }}>{item}</div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading || platforms.length === 0} className="apple-btn">
            {loading ? 'Creating campaign…' : 'Post campaign'}
          </button>
        </section>
      </form>
    </div>
  )
}
