import Link from 'next/link'
import { PublicPageShell } from '@/app/PublicPageShell'

export default function SupportPage() {
  return (
    <PublicPageShell
      eyebrow="Support"
      title="Get help with campaigns, payouts, and account issues."
      description="Use this page as the main support surface for brands and creators. It covers where to reach out and what details help resolve issues fastest."
    >
      <section className="dashboard-panel">
        <h2>Contact support</h2>
        <p className="page-copy" style={{ margin: 0 }}>
          Email <a href="mailto:support@coreloop.com" className="apple-link">support@coreloop.com</a> for account access issues,
          payout questions, campaign problems, or anything blocking a creator or brand workflow.
        </p>
      </section>

      <section className="dashboard-panel">
        <h2>What to include</h2>
        <p className="page-copy" style={{ margin: 0 }}>
          Include your account email, the campaign or application involved, what happened, what you expected, and any screenshots or links that help reproduce the issue.
        </p>
      </section>

      <section className="dashboard-panel">
        <h2>Best uses for support</h2>
        <div className="subtle-grid">
          {[
            'Payout onboarding problems',
            'Campaign submission or approval issues',
            'Application flow bugs',
            'Account access or redirect problems',
            'Questions about privacy or terms',
          ].map(item => (
            <div key={item} className="pill" style={{ justifyContent: 'flex-start' }}>{item}</div>
          ))}
        </div>
      </section>

      <section className="dashboard-panel">
        <h2>Need to go back?</h2>
        <p className="page-copy" style={{ margin: '0 0 14px' }}>
          Return to the homepage, sign in, or continue creating your account.
        </p>
        <div className="cta-row">
          <Link href="/" className="apple-btn-ghost">Home</Link>
          <Link href="/sign-in" className="apple-btn-ghost">Sign in</Link>
          <Link href="/sign-up" className="apple-btn">Create account</Link>
        </div>
      </section>
    </PublicPageShell>
  )
}
