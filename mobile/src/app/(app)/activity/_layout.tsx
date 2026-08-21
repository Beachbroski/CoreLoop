import { Stack } from 'expo-router';

/**
 * The Activity tab is a stack — see `discover/_layout.tsx` for why the
 * `href: null` tab registrations these replace were the wrong shape.
 *
 * `submissions/new` and `submissions/[id]` are siblings here rather than
 * nested, which is what the file tree already describes: expo-router prefers
 * the static segment, so `/activity/submissions/new` never resolves as an
 * id of "new".
 */
export default function ActivityStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="applications/[id]" />
      <Stack.Screen name="submissions/[id]" />
      {/* Create flow — modal, for the same reason as `discover/[id]/apply`. */}
      <Stack.Screen name="submissions/new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
