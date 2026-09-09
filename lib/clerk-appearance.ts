import type { Appearance } from '@clerk/types'

/**
 * Both exports are `satisfies Appearance` rather than bare object literals.
 *
 * That is load-bearing, not decoration. These objects are passed as
 * `appearance={authClerkAppearance}` — a variable, not a fresh literal at the
 * call site — so TypeScript's excess-property check never ran on them. A block
 * of keys sat under a misspelled parent (`options`) for months: Clerk silently
 * ignored it, and the sign-in and sign-up screens rendered with no terms,
 * privacy or help link at all. Nothing failed; the links simply were not there.
 *
 * `satisfies` moves that check to the definition site, where a wrong key name
 * or a wrongly-nested block is a compile error.
 */
export const baseClerkAppearance = {
  // `layout` is read from the ClerkProvider-level appearance, not from a
  // component's own `appearance` prop. The type allows it in both places
  // (Layout sits on Theme, which is what SignUpTheme resolves to), so putting
  // it on <SignUp> compiles cleanly and then silently does nothing — verified
  // in a browser: the config reached the client and Clerk ignored it.
  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
    // The legal footer on Clerk's own cards. This is the only place terms and
    // privacy are presented at web sign-up — there is no separate consent step
    // — and App Review expects a reachable privacy link (Guideline 5.1.1(i)).
    privacyPageUrl: '/privacy',
    termsPageUrl: '/terms',
    helpPageUrl: '/support',
  },
  variables: {
    colorPrimary: '#0071e3',
    colorBackground: '#ffffff',
    colorInputBackground: '#f5f5f7',
    colorInputText: '#1d1d1f',
    colorText: '#1d1d1f',
    colorTextSecondary: '#6e6e73',
    colorDanger: '#ff3b30',
    borderRadius: '18px',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontSize: '17px',
  },
  elements: {
    card: 'shadow-none border border-[rgba(15,23,42,0.08)] rounded-[28px] backdrop-blur-xl',
    formButtonPrimary: 'rounded-full font-medium',
  },
} satisfies Appearance

export const authClerkAppearance = {
  ...baseClerkAppearance,
  elements: {
    ...baseClerkAppearance.elements,
    rootBox: 'w-full',
    cardBox: 'w-full',
    card: 'shadow-none border-0 rounded-none bg-transparent p-0',
    headerTitle:
      'text-[2.25rem] leading-[0.98] tracking-[-0.05em] font-semibold text-[#0f1728] sm:text-[2.7rem]',
    headerSubtitle: 'text-[1rem] leading-7 text-[#667085]',
    socialButtonsBlockButton:
      'min-h-12 rounded-full border border-[rgba(15,23,42,0.08)] bg-white text-[#101828] shadow-none',
    socialButtonsBlockButtonText: 'text-[0.95rem] font-medium',
    formFieldInput: 'rounded-[18px] border border-transparent bg-[#f5f5f7] text-[#1d1d1f]',
    formFieldLabel: 'font-medium text-[#101828]',
    formButtonPrimary: 'min-h-12 rounded-full font-medium shadow-none',
    footerAction: 'pt-4',
    footerActionText: 'text-[#667085]',
    footerActionLink: 'font-semibold text-[#0071e3]',
    identityPreviewText: 'text-[#667085]',
    formResendCodeLink: 'font-semibold text-[#0071e3]',
    otpCodeFieldInput: 'rounded-[18px] border border-transparent bg-[#f5f5f7]',
  },
} satisfies Appearance
