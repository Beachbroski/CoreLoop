import { PublicPageShell } from '@/app/PublicPageShell'

export default function SupportPage() {
  return (
    <PublicPageShell
      eyebrow="Support"
      title="Get help with waitlist access, testing accounts, and payout setup."
      description="Use this page as the main support surface for CreatorDocks. It covers public waitlist questions plus internal testing issues for approved accounts."
    >
      <section className="dashboard-panel">
        <h2>Contact support</h2>
        <p className="page-copy" style={{ margin: 0 }}>
          Email <a href="mailto:support@creatordocks.com" className="apple-link">support@creatordocks.com</a> for waitlist questions,
          tester access issues, payout setup problems, or anything blocking a creator workflow.
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
    </PublicPageShell>
  )
}
