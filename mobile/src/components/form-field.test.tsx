import { createRef } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { FormField } from './form-field';

/**
 * FormField exists to close three findings at once, and each of them is
 * invisible on screen — which is exactly why they survived to an audit:
 *
 *   1. Every TextInput in the app used its placeholder as its only label. A
 *      placeholder is not an accessible name and it vanishes on focus, so a
 *      VoiceOver user heard "text field" and a sighted user lost the label the
 *      moment they started typing.
 *   2. Only the Discover search field wired up its return key. Everywhere else
 *      Return did nothing instead of advancing or submitting — and on the
 *      `decimal-pad` rate field iOS draws no return key at all, leaving the
 *      creator with no way to dismiss the keyboard.
 *   3. An input's only boundary was the decorative `border` whisper (1.18:1),
 *      so the fields read as borderless.
 *
 * These tests pin all three, plus the two states that are easy to regress:
 * focus and error.
 *
 * `useColorScheme` is pinned to dark so border assertions can name exact token
 * values rather than accepting either scheme's.
 */
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'dark' }));

const theme = Colors.dark;

/** The box that draws the border is the input's host parent. */
function borderColorOf(label: string): unknown {
  const box = screen.getByLabelText(label).parent;
  return StyleSheet.flatten(box?.props.style).borderColor;
}

describe('FormField', () => {
  describe('accessible naming', () => {
    it('gives the input the visible label as its accessible name', async () => {
      await renderWithProviders(<FormField label="Caption" value="" onChangeText={jest.fn()} />);

      expect(screen.getByLabelText('Caption')).toBeOnTheScreen();
      // The label Text is deliberately hidden from the accessibility tree, so
      // it only turns up with `includeHiddenElements`.
      expect(screen.getByText('Caption', { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it('names a placeholder-only field without showing a label', async () => {
      await renderWithProviders(
        <FormField accessibilityLabel="Email" placeholder="Email" value="" onChangeText={jest.fn()} />,
      );

      expect(screen.getByLabelText('Email')).toBeOnTheScreen();
      // Only the placeholder is on screen — no visible label was added.
      expect(screen.queryByText('Email')).toBeNull();
    });

    it('prefers an explicit accessibilityLabel over the visible label', async () => {
      await renderWithProviders(
        <FormField label="Rate" accessibilityLabel="Your rate in dollars" value="" onChangeText={jest.fn()} />,
      );

      expect(screen.getByLabelText('Your rate in dollars')).toBeOnTheScreen();
    });

    it('keeps the visible label out of the accessibility tree so the field is one stop', async () => {
      await renderWithProviders(<FormField label="Caption" value="" onChangeText={jest.fn()} />);

      expect(screen.queryByText('Caption')).toBeNull();
      expect(
        screen.getByText('Caption', { includeHiddenElements: true }).props.accessibilityElementsHidden,
      ).toBe(true);
    });
  });

  describe('error state', () => {
    it('shows the message and announces it as part of the field name', async () => {
      await renderWithProviders(
        <FormField label="Email" error="Enter a valid email" value="" onChangeText={jest.fn()} />,
      );

      expect(screen.getByText('Enter a valid email')).toBeOnTheScreen();
      // RN has no `accessibilityState.invalid`, so without this a VoiceOver
      // user hears "Email" on a field the sighted user sees outlined in red.
      expect(screen.getByLabelText('Email, invalid. Enter a valid email')).toBeOnTheScreen();
    });

    it('outranks focus, so a field being edited still reads as wrong', async () => {
      const name = 'Email, invalid. Enter a valid email';
      await renderWithProviders(
        <FormField label="Email" error="Enter a valid email" value="" onChangeText={jest.fn()} />,
      );

      await fireEvent(screen.getByLabelText(name), 'focus');

      expect(borderColorOf(name)).toBe(theme.danger);
    });
  });

  describe('boundary and focus', () => {
    it('rests on borderStrong rather than the decorative border whisper', async () => {
      await renderWithProviders(<FormField label="Caption" value="" onChangeText={jest.fn()} />);

      expect(borderColorOf('Caption')).toBe(theme.borderStrong);
      expect(borderColorOf('Caption')).not.toBe(theme.border);
    });

    it('swaps to the accent ring on focus and back on blur', async () => {
      await renderWithProviders(<FormField label="Caption" value="" onChangeText={jest.fn()} />);

      await fireEvent(screen.getByLabelText('Caption'), 'focus');
      expect(borderColorOf('Caption')).toBe(theme.accent);

      await fireEvent(screen.getByLabelText('Caption'), 'blur');
      expect(borderColorOf('Caption')).toBe(theme.borderStrong);
    });

    it("still calls the screen's own focus and blur handlers", async () => {
      const onFocus = jest.fn();
      const onBlur = jest.fn();
      await renderWithProviders(
        <FormField label="Caption" value="" onChangeText={jest.fn()} onFocus={onFocus} onBlur={onBlur} />,
      );

      await fireEvent(screen.getByLabelText('Caption'), 'focus');
      await fireEvent(screen.getByLabelText('Caption'), 'blur');

      expect(onFocus).toHaveBeenCalled();
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('return key', () => {
    it('forwards a ref so a screen can chain one field to the next', async () => {
      const ref = createRef<TextInput>();
      await renderWithProviders(<FormField ref={ref} label="Password" value="" onChangeText={jest.fn()} />);

      expect(ref.current).not.toBeNull();
      expect(typeof ref.current?.focus).toBe('function');
    });

    it('passes returnKeyType and onSubmitEditing through to the input', async () => {
      const onSubmitEditing = jest.fn();
      await renderWithProviders(
        <FormField
          label="Email"
          value=""
          onChangeText={jest.fn()}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={onSubmitEditing}
        />,
      );

      const input = screen.getByLabelText('Email');
      expect(input.props.returnKeyType).toBe('next');
      expect(input.props.submitBehavior).toBe('submit');

      await fireEvent(input, 'submitEditing');
      expect(onSubmitEditing).toHaveBeenCalled();
    });

    it('gives a decimal-pad field the Done bar iOS never draws for it', async () => {
      await renderWithProviders(
        <FormField accessibilityLabel="Your rate" keyboardType="decimal-pad" value="" onChangeText={jest.fn()} />,
      );

      expect(screen.getByLabelText('Done')).toBeOnTheScreen();
      expect(screen.getByLabelText('Your rate').props.inputAccessoryViewID).toBeTruthy();
    });

    it('leaves keyboards that do have a return key alone', async () => {
      await renderWithProviders(
        <FormField accessibilityLabel="Email" keyboardType="email-address" value="" onChangeText={jest.fn()} />,
      );

      expect(screen.queryByLabelText('Done')).toBeNull();
      expect(screen.getByLabelText('Email').props.inputAccessoryViewID).toBeUndefined();
    });

    it('dismisses the keyboard and reports Done to the screen', async () => {
      const onDone = jest.fn();
      await renderWithProviders(
        <FormField
          accessibilityLabel="Your rate"
          keyboardType="decimal-pad"
          onDone={onDone}
          value=""
          onChangeText={jest.fn()}
        />,
      );

      await fireEvent.press(screen.getByLabelText('Done'));

      expect(onDone).toHaveBeenCalled();
    });
  });

  describe('slots', () => {
    it('renders a leading prefix without adding a VoiceOver stop for it', async () => {
      await renderWithProviders(
        <FormField
          accessibilityLabel="Your rate"
          leading={<ThemedText type="smallBold">$</ThemedText>}
          value=""
          onChangeText={jest.fn()}
        />,
      );

      // Visible on screen, absent from the accessibility tree — a `$` should
      // not be its own VoiceOver stop in front of the rate field.
      expect(screen.queryByText('$')).toBeNull();
      const prefix = screen.getByText('$', { includeHiddenElements: true });
      expect(prefix.parent?.props.accessibilityElementsHidden).toBe(true);
    });

    it('renders helper content under the field', async () => {
      await renderWithProviders(
        <FormField
          label="Pitch"
          multiline
          helper={<ThemedText type="small">3 / 20 min</ThemedText>}
          value=""
          onChangeText={jest.fn()}
        />,
      );

      expect(screen.getByText('3 / 20 min')).toBeOnTheScreen();
    });

    it('gives a multiline field room to breathe and top-aligned text', async () => {
      await renderWithProviders(<FormField label="Pitch" multiline value="" onChangeText={jest.fn()} />);

      const input = screen.getByLabelText('Pitch');
      const style = StyleSheet.flatten(input.props.style);
      expect(input.props.multiline).toBe(true);
      expect(style.textAlignVertical).toBe('top');
      expect(style.minHeight).toBeGreaterThan(0);
    });
  });

  describe('dynamic type', () => {
    it('never pins a fixed height on the box', async () => {
      await renderWithProviders(<FormField label="Caption" value="" onChangeText={jest.fn()} />);

      const box = StyleSheet.flatten(screen.getByLabelText('Caption').parent?.props.style);
      // A fixed `height` here clips the input's own text at the first
      // accessibility size — see the Dynamic Type policy in themed-text.tsx.
      expect(box.height).toBeUndefined();
      expect(box.minHeight).toBeGreaterThanOrEqual(44);
    });
  });
});
