/**
 * Public marketing-site links the app opens in an in-app browser.
 *
 * Apple Guideline 5.1.1(i) — and App Review in practice — expects a
 * privacy-policy link reachable from inside the app. The base URL lives here,
 * once, so nothing downstream hardcodes the host.
 */
export const MARKETING_SITE_URL = 'https://www.creatordocks.com';

export const LEGAL_LINKS = {
  privacyPolicy: `${MARKETING_SITE_URL}/privacy`,
  termsOfUse: `${MARKETING_SITE_URL}/terms`,
  support: `${MARKETING_SITE_URL}/support`,
} as const;
