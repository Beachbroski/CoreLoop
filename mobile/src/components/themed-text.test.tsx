import { renderWithProviders, screen } from '@/test/render';
import { ThemedText } from './themed-text';

/**
 * These tests are the Dynamic Type policy in executable form. The policy lives
 * as prose at the top of themed-text.tsx; this file is what stops it rotting,
 * for the same reason theme.contrast.test.ts exists — a comment cannot fail a
 * build, and the app already shipped one policy-by-accident.
 */
describe('ThemedText Dynamic Type policy', () => {
  describe('rule 1 — body text scales without a cap', () => {
    it.each(['default', 'small', 'smallBold', 'link'] as const)('leaves %s uncapped', async (type) => {
      await renderWithProviders(<ThemedText type={type}>Body</ThemedText>);

      // `undefined` is the absence of a ceiling. A number here would be the
      // accessibility failure the policy exists to prevent.
      expect(screen.getByText('Body').props.maxFontSizeMultiplier).toBeUndefined();
    });
  });

  describe('rule 2 — display text is capped', () => {
    it.each(['title', 'subtitle', 'money'] as const)('caps %s', async (type) => {
      await renderWithProviders(<ThemedText type={type}>Display</ThemedText>);

      const cap = screen.getByText('Display').props.maxFontSizeMultiplier;
      expect(cap).toBeGreaterThan(1);
      // Still more generous than Apple's own display type, whose Large Title
      // moves 34pt → 44pt (1.29x) across the whole range.
      expect(cap).toBeGreaterThan(1.29);
    });
  });

  it('lets a call site override the ceiling it was given', async () => {
    await renderWithProviders(
      <ThemedText type="title" maxFontSizeMultiplier={1.1}>
        Pinned
      </ThemedText>,
    );

    expect(screen.getByText('Pinned').props.maxFontSizeMultiplier).toBe(1.1);
  });

  it('lets a call site opt out of scaling entirely (rule 3)', async () => {
    await renderWithProviders(<ThemedText allowFontScaling={false}>AB</ThemedText>);

    expect(screen.getByText('AB').props.allowFontScaling).toBe(false);
  });
});
