export const baseClerkAppearance = {
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
}

export const authClerkAppearance = {
  ...baseClerkAppearance,
  options: {
    elevation: 'flush',
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
    privacyPageUrl: '/privacy',
    termsPageUrl: '/terms',
    helpPageUrl: '/support',
  },
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
}
