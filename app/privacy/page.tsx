import { PublicPageShell } from '@/app/PublicPageShell'

const sections = [
  {
    title: 'What we collect',
    body:
      'CreatorDocks collects the information needed to run the public creator waitlist and internal marketplace environment, including account details, waitlist submissions, campaign and application content, payout-related information, and basic usage data.',
  },
  {
    title: 'How we use it',
    body:
      'We use your information to operate the platform, authenticate accounts, process payments, support creator and brand workflows, improve the product, and communicate important account or transaction updates.',
  },
  {
    title: 'Payments and third parties',
    body:
      'Payments and onboarding may be processed by third-party providers such as Stripe, authentication by Clerk, and file handling by UploadThing. Those services may receive the information required to perform their part of the workflow.',
  },
  {
    title: 'Retention and security',
    body:
      'We keep information for as long as needed to operate the platform, resolve disputes, meet legal obligations, and maintain transaction records. We use reasonable safeguards, but no online system can promise absolute security.',
  },
  {
    title: 'Your choices',
    body:
      'You can request account updates or deletion, subject to any legal, payment, or record-keeping obligations that require some information to be retained.',
  },
  {
    title: 'Contact',
    body:
      'Questions about privacy can be sent to support@creatordocks.com.',
  },
]

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy"
      title="Privacy policy for CreatorDocks."
      description="This page explains the basic information CreatorDocks collects, why it is collected, and how it is used across the public waitlist and internal creator marketplace workflows."
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
