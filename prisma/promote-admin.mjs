import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Promotes an existing user to ADMIN. The email must already be listed in
// ADMIN_ALLOWED_EMAILS — the app checks both the role and the allowlist, so a
// promotion outside the allowlist would produce an account that cannot reach
// the internal dashboard anyway.
//
// Usage: npm run promote:admin -- you@example.com

const emailArg = process.argv[2]

if (!emailArg) {
  console.error('Usage: npm run promote:admin -- <email>')
  process.exit(1)
}

const email = emailArg.trim().toLowerCase()

const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS ?? '')
  .split(',')
  .map(entry => entry.trim().toLowerCase())
  .filter(Boolean)

if (!allowedEmails.includes(email)) {
  console.error(
    `Refusing to promote ${email}: it is not listed in ADMIN_ALLOWED_EMAILS.\n` +
      'Add the email to ADMIN_ALLOWED_EMAILS in your environment first, then re-run this script.',
  )
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

try {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    console.error(
      `No user found with email ${email}.\n` +
        'Sign in once and pick a role on /onboarding so the account exists, then re-run this script.',
    )
    process.exit(1)
  }

  if (user.role === 'ADMIN') {
    console.log(`${email} is already an ADMIN. Nothing to do.`)
    process.exit(0)
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  console.log(`Promoted ${email} to ADMIN. They will land on the internal dashboard on next sign-in.`)
} finally {
  await prisma.$disconnect()
}
