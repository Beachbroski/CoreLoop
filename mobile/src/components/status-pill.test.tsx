import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { renderWithProviders, screen } from '@/test/render';
import { StatusPill } from './status-pill';

// See use-theme.test.tsx: the app's own indirection module is the seam. Mocking
// 'react-native' directly walks its deprecated module getters and kills the suite.
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn() }));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

/**
 * The pill is the only place a status is rendered, which makes it the only
 * place two contract-level guarantees can be held:
 *
 * 1. **The word is always there.** WCAG 1.4.1 — a tint alone cannot be the
 *    difference between "approved" and "rejected". Every call site renders
 *    this component rather than a bare dot, so pinning the label here pins it
 *    app-wide.
 * 2. **The corrected tokens are the ones actually consumed.** Wave 1 darkened
 *    `warning`/`success`/`danger` to clear AA on their soft washes. A token
 *    that moves while a component keeps painting the old one is exactly the
 *    drift `theme.contrast.test.ts` cannot see — it grades the palette, not
 *    the markup. This grades the markup.
 */
beforeEach(() => mockUseColorScheme.mockReset().mockReturnValue('light'));

describe('StatusPill labelling', () => {
  it.each([
    ['PENDING', 'Pending'],
    ['APPROVED', 'Approved'],
    ['REJECTED', 'Rejected'],
    ['REVISION_REQUESTED', 'Revision Requested'],
    ['PAID', 'Paid'],
  ])('renders %s as the visible word "%s"', async (status, label) => {
    await renderWithProviders(<StatusPill status={status} />);

    // Visible text, not just an accessibility label: 1.4.1 is about what a
    // sighted colorblind creator can see, and a11y labels are invisible.
    expect(screen.getByText(label)).toBeOnTheScreen();
  });

  it('announces the word as a status rather than a bare adjective', async () => {
    await renderWithProviders(<StatusPill status="APPROVED" />);

    expect(screen.getByLabelText('Status: Approved')).toBeOnTheScreen();
  });

  it('still shows a word for a status it has never heard of', async () => {
    await renderWithProviders(<StatusPill status="ESCROW_HELD" />);

    expect(screen.getByText('Escrow Held')).toBeOnTheScreen();
  });
});

describe('StatusPill token consumption', () => {
  it.each([
    ['PENDING', 'Pending', 'warning', 'warningSoft'],
    ['PROCESSING', 'Processing', 'warning', 'warningSoft'],
    ['APPROVED', 'Approved', 'success', 'successSoft'],
    ['PAID', 'Paid', 'success', 'successSoft'],
    ['REJECTED', 'Rejected', 'danger', 'dangerSoft'],
    ['FAILED', 'Failed', 'danger', 'dangerSoft'],
  ] as const)('paints %s ("%s") with %s on %s', async (status, label, textToken, fillToken) => {
    await renderWithProviders(<StatusPill status={status} />);

    expect(screen.getByText(label)).toHaveStyle({ color: Colors.light[textToken] });
    expect(screen.getByLabelText(`Status: ${label}`)).toHaveStyle({
      backgroundColor: Colors.light[fillToken],
    });
  });

  it.each(['light', 'dark'] as const)('reads the %s palette, not a hard-coded hex', async (scheme) => {
    mockUseColorScheme.mockReturnValue(scheme);

    await renderWithProviders(<StatusPill status="PENDING" />);

    expect(screen.getByText('Pending')).toHaveStyle({ color: Colors[scheme].warning });
    expect(screen.getByLabelText('Status: Pending')).toHaveStyle({
      backgroundColor: Colors[scheme].warningSoft,
    });
  });

  /**
   * The fallback was the pairing the original audit missed: an unknown status
   * has no wash, so the pill is an opaque `backgroundSelected` chip and the
   * text is `textSecondary` — 4.63:1 light, 4.42:1 before Wave 1 nudged it.
   */
  it('falls back to textSecondary on an opaque backgroundSelected chip', async () => {
    await renderWithProviders(<StatusPill status="ESCROW_HELD" />);

    expect(screen.getByText('Escrow Held')).toHaveStyle({ color: Colors.light.textSecondary });
    expect(screen.getByLabelText('Status: Escrow Held')).toHaveStyle({
      backgroundColor: Colors.light.backgroundSelected,
    });
  });
});
