import { Stack } from 'expo-router';

/**
 * The Discover tab is a stack, not a flat list of tabs.
 *
 * Before this layout existed, `discover/[id]` and `discover/[id]/apply` were
 * registered on the tab navigator with `href: null`. That hides them from the
 * tab bar but they are still *tabs*: `router.push()` was a lateral tab switch,
 * so a campaign opened with no slide-in transition and no interactive
 * left-edge swipe back — the two things that tell an iOS user "you went one
 * level deeper, and you can get out the way you came in".
 *
 * Headers stay off: every screen in here draws its own `BackHeader`, and the
 * swipe-back gesture is a property of the native stack, not of the header, so
 * hiding the header costs nothing.
 */
export default function DiscoverStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]/index" />
      {/*
       * Applying is a create flow. A modal is the honest container for one:
       * it says "finish this or cancel it" rather than letting a stray tab tap
       * silently strand a half-written pitch behind another screen.
       */}
      <Stack.Screen name="[id]/apply" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
