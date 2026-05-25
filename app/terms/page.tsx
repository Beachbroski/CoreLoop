import { PublicPageShell } from '@/app/PublicPageShell'

const sections = [
  {
    title: 'Using CoreLoop',
    body:
      'By using CoreLoop, you agree to use the platform lawfully and in a way that supports legitimate creator and brand transactions.',
  },
  {
    title: 'Accounts',
    body:
      'You are responsible for keeping your account information accurate, protecting your login credentials, and using the correct role and payment details for your business or creator activity.',
  },
  {
    title: 'Campaigns, applications, and content',
    body:
      'Brands are responsible for the briefs they post and creators are responsible for the accuracy of their pitches, deliverables, and any rights they claim in submitted content.',
  },
  {
    title: 'Payments and fees',
    body:
      'CoreLoop may use payment providers such as Stripe to authorize, hold, and release funds. Platform fees, processor fees, and payout timing may vary based on the transaction flow and provider rules.',
  },
  {
    title: 'Prohibited conduct',
    body:
      'Users may not use CoreLoop for fraud, impersonation, unlawful campaigns, infringement, spam, payment abuse, or attempts to bypass the platform’s trust and payment systems.',
  },
  {
    title: 'Suspension and termination',
    body:
      'CoreLoop may limit, suspend, or terminate access to protect the marketplace, comply with legal requirements, or respond to abuse, disputes, or policy violations.',
  },
  {
    title: 'Disclaimers',
    body:
      'CoreLoop provides the platform as-is and does not guarantee uninterrupted service, campaign success, or a specific business outcome for brands or creators.',
  },
  {
    title: 'Contact',
    body:
      'Questions about these terms can be sent to support@coreloop.com.',
  },
]

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Terms"
      title="Terms of use for brands, creators, and marketplace activity."
      description="These terms describe the basic rules for using CoreLoop, including accounts, campaigns, submitted content, payments, and acceptable behavior on the platform."
    >
      {sections.map(section => (
        <section key={section.title} className="dashboard-panel">
          <h2>{section.title}</h2>
          <p className="page-copy" style={{ margin: 0 }}>{section.body}</p>
        </section>
      ))}
    </PublicPageShell>
  )
}
