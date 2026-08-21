import * as Haptics from 'expo-haptics';
import { useId, useState, type ReactNode, type Ref } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

/** Matches `PrimaryButton`/`SettingsRow` so a form reads as one stack of controls. */
const FIELD_MIN_HEIGHT = 52;
/** Apple's 44pt floor, as a *minimum* so every control grows with Dynamic Type. */
const MIN_TAP_TARGET = 44;
/** Enough room to see a few lines of a pitch before scrolling starts. */
const MULTILINE_MIN_HEIGHT = 120;
/** The Discover search box's existing 15pt corner — deliberately off the spacing scale. */
const PILL_RADIUS = 15;

export type FormFieldShape = 'box' | 'pill';

// Derived from the TextInput props rather than named directly: RN renamed these
// payloads between releases (`TextInputFocusEventData` → `FocusEvent`/`BlurEvent`),
// and there is no reason for this file to care which release it is compiling on.
type FocusEventArg = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
type BlurEventArg = Parameters<NonNullable<TextInputProps['onBlur']>>[0];

/**
 * A field MUST have an accessible name, and the type system is where that gets
 * enforced rather than a code review. Every TextInput in the app used its
 * placeholder as its only label, which VoiceOver does not read and which
 * vanishes the moment the user types — so "you may omit the name" is exactly
 * the affordance this component must not offer.
 *
 * Either give the field a visible `label` (its words become the accessible name
 * automatically), or, when the design is placeholder-only, name it explicitly
 * with `accessibilityLabel`. `accessibilityLabel` wins when both are present.
 */
type FormFieldLabelling =
  | { label: string; accessibilityLabel?: string }
  | { label?: undefined; accessibilityLabel: string };

type FormFieldOwnProps = {
  /**
   * Forwarded to the underlying TextInput so a screen can chain fields:
   * `onSubmitEditing={() => passwordRef.current?.focus()}`.
   */
  ref?: Ref<TextInput>;
  /** Message shown under the field; also reddens the border and the announced name. */
  error?: string | null;
  /** Extra content under the field (the pitch screen's "12 / 20 min" counter). */
  helper?: ReactNode;
  /** Content inside the box, before the input: a search glyph, a `$` prefix. Hidden from VoiceOver. */
  leading?: ReactNode;
  /** `box` (default) for form fields, `pill` for the Discover search bar. */
  shape?: FormFieldShape;
  /** Called after the iOS Done bar dismisses a return-key-less keyboard. */
  onDone?: () => void;
  /** Force the Done bar on or off. By default it appears only where iOS gives no return key. */
  doneAccessory?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export type FormFieldProps = Omit<TextInputProps, 'accessibilityLabel' | 'placeholderTextColor' | 'style'> &
  FormFieldOwnProps &
  FormFieldLabelling;

/**
 * iOS numeric keypads have no return key at all, so `returnKeyType` and
 * `onSubmitEditing` are dead props there and the keyboard has no dismiss
 * affordance of its own — a creator who taps the rate field is stuck behind it.
 * These are the keyboards that need the Done bar.
 */
function keyboardHasNoReturnKey(keyboardType: TextInputProps['keyboardType']): boolean {
  switch (keyboardType) {
    case 'decimal-pad':
    case 'number-pad':
    case 'numeric':
    case 'phone-pad':
      return true;
    default:
      return false;
  }
}

/**
 * The one text-input control. It exists because three separate audit findings
 * were one missing component: no field in the app had an accessible name, only
 * the Discover search field wired up its return key, and the only boundary an
 * input drew was the decorative `border` whisper.
 *
 * So: naming is mandatory (see `FormFieldLabelling`), the return key is the
 * caller's to spend via the passed-through `returnKeyType`/`onSubmitEditing`
 * with a `ref` to chain to, and the resting outline is `borderStrong` — the
 * token sized for controls whose outline IS the affordance.
 *
 * Everything `TextInput` accepts is passed straight through — `value`,
 * `onChangeText`, `secureTextEntry`, `autoComplete`, `autoCapitalize`,
 * `clearButtonMode`, `returnKeyType`, `submitBehavior`, `onSubmitEditing`,
 * `testID`. Only four props are taken over: `accessibilityLabel` (composed with
 * the error), `placeholderTextColor` and `style` (themed here), and
 * `keyboardType` (which also decides the Done bar).
 *
 * The four shapes the app needs:
 *
 *   // Placeholder-only, chained to the next field.
 *   <FormField accessibilityLabel="Email" placeholder="Email" ref={emailRef}
 *     returnKeyType="next" submitBehavior="submit"
 *     onSubmitEditing={() => passwordRef.current?.focus()} … />
 *
 *   // Labelled text area with a live counter underneath.
 *   <FormField label="Pitch" multiline helper={<ThemedText …>{n} / 20 min</ThemedText>} … />
 *
 *   // Currency: the `$` is decoration, and the Done bar appears by itself
 *   // because `decimal-pad` has no return key on iOS.
 *   <FormField accessibilityLabel="Your rate in dollars" keyboardType="decimal-pad"
 *     leading={<ThemedText type="smallBold" themeColor="textSecondary">$</ThemedText>} … />
 *
 *   // Discover search.
 *   <FormField accessibilityLabel="Search campaigns" shape="pill" returnKeyType="search"
 *     clearButtonMode="while-editing" leading={<SymbolView … />} … />
 */
export function FormField({
  ref,
  label,
  accessibilityLabel,
  error,
  helper,
  leading,
  shape = 'box',
  onDone,
  doneAccessory,
  containerStyle,
  inputStyle,
  keyboardType,
  multiline,
  onFocus,
  onBlur,
  ...input
}: FormFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const accessoryId = useId();

  const name = accessibilityLabel ?? label;
  // RN has no `accessibilityState.invalid`, so the error rides on the name.
  // Without this a VoiceOver user hears "Email" on a field the sighted user
  // sees outlined in red with a message under it.
  const announcedName = error && name ? `${name}, invalid. ${error}` : name;

  // Error outranks focus: a red field the user is currently editing is still
  // wrong, and swapping it to the accent ring hides that until they leave.
  const borderColor = error ? theme.danger : focused ? theme.accent : theme.borderStrong;
  const showDoneBar = (doneAccessory ?? keyboardHasNoReturnKey(keyboardType)) && Platform.OS === 'ios';

  function handleFocus(event: FocusEventArg) {
    setFocused(true);
    onFocus?.(event);
  }

  function handleBlur(event: BlurEventArg) {
    setFocused(false);
    onBlur?.(event);
  }

  return (
    <View style={[styles.field, containerStyle]}>
      {label ? (
        // Hidden from VoiceOver on purpose: these exact words are already the
        // input's accessible name, and leaving the Text in the tree makes the
        // field two stops that say the same thing.
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {label}
        </ThemedText>
      ) : null}

      <View
        style={[
          styles.box,
          shape === 'pill' ? styles.pill : styles.boxed,
          multiline ? styles.boxMultiline : null,
          { backgroundColor: theme.backgroundElement, borderColor },
        ]}>
        {leading ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {leading}
          </View>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={announcedName}
          placeholderTextColor={theme.textSecondary}
          keyboardType={keyboardType}
          multiline={multiline}
          inputAccessoryViewID={showDoneBar ? accessoryId : undefined}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, multiline ? styles.multilineInput : null, { color: theme.text }, inputStyle]}
          {...input}
        />
      </View>

      {helper}

      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}

      {showDoneBar ? <DoneAccessory nativeID={accessoryId} onDone={onDone} /> : null}
    </View>
  );
}

/** The keyboard toolbar that gives a numeric keypad the dismiss affordance iOS omits. */
function DoneAccessory({ nativeID, onDone }: { nativeID: string; onDone?: () => void }) {
  const theme = useTheme();

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    onDone?.();
  }

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={[styles.accessoryBar, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border }]}>
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel="Done"
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.accessoryButton, pressed ? styles.accessoryButtonPressed : null]}>
          <ThemedText type="smallBold" themeColor="accent">
            Done
          </ThemedText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    // `minHeight`, never `height`: the label inside scales with Dynamic Type
    // and a fixed height clips it at the first accessibility size.
    minHeight: FIELD_MIN_HEIGHT,
  },
  boxed: {
    borderRadius: Spacing.two,
  },
  pill: {
    borderRadius: PILL_RADIUS,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: Spacing.three - 1,
  },
  boxMultiline: {
    // A `$` prefix or icon belongs at the first line of a text area, not
    // floating in the vertical middle of six lines.
    alignItems: 'flex-start',
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
  },
  multilineInput: {
    minHeight: MULTILINE_MIN_HEIGHT,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  accessoryButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  accessoryButtonPressed: {
    opacity: 0.6,
  },
});
