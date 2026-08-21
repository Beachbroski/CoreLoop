import { useAuth } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useTheme } from '@/hooks/use-theme';
import { isNotInvitedError, useEnsureAccount } from '@/lib/queries/use-ensure-account';

type SymbolName = Parameters<typeof SymbolView>[0]['name'];

/** Shown while the account is being resolved or created on first launch. */
function AccountLoading() {
  const theme = useTheme();

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.centered}>
        <Logo size={44} />
        <ActivityIndicator color={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary">
          Setting up your account…
        </ThemedText>
      </View>
    </Screen>
  );
}

/**
 * CreatorDocks is invite-only while in waitlist mode. Without this the app
 * would render four tabs that all fail, with retry buttons that can never
 * succeed — this says what is actually happening instead.
 */
function WaitlistGate() {
  const { signOut } = useAuth();

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.centered}>
        <Logo size={56} />
        <ThemedText type="subtitle" style={styles.gateTitle}>
          You&apos;re on the list
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.gateBody}>
          CreatorDocks is invite-only right now. We&apos;ll email you as soon as your spot opens up.
        </ThemedText>
        {/*
         * A Pressable, not a Text with `onPress`. The 44pt minimum is a hit
         * target, and centering text inside one needs a box that can center —
         * `textAlignVertical` was doing that job, but it is an Android-only
         * prop, so on iOS the label sat at the top of its 44pt box.
         */}
        <Pressable
          onPress={() => signOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          hitSlop={Spacing.two}
          style={styles.gateAction}>
          <ThemedText type="link" themeColor="accent">
            Sign out
          </ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

function TabIcon({
  focused,
  name,
  filledName,
  color,
}: {
  focused: boolean;
  name: SymbolName;
  filledName: SymbolName;
  color: ColorValue;
}) {
  return <SymbolView name={focused ? filledName : name} size={24} tintColor={color as string} />;
}

/** Selection tick on every tab switch — the tab bar is the most-touched control in the app. */
function onTabPress() {
  Haptics.selectionAsync();
}

export default function AppTabsLayout() {
  const theme = useTheme();
  const { isLoaded, isSignedIn } = useAuth();

  // This layout is the single choke point every authenticated session crosses
  // — a cold launch of an already-signed-in device reaches the tabs without
  // passing through any sign-in screen, so account setup has to live here
  // rather than in the auth flows.
  const account = useEnsureAccount();

  // Device registration is the first authenticated call the app makes and it
  // 401s until the account row exists, so hold it until we have one.
  usePushNotifications(Boolean(account.data));

  if (!isLoaded) return null;

  // Defense in depth: a deep link could land here directly, bypassing the
  // root index redirect.
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  if (account.isPending) return <AccountLoading />;
  if (isNotInvitedError(account.error)) return <WaitlistGate />;
  if (account.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ErrorState message="Couldn't open your account." onRetry={account.refetch} />
      </Screen>
    );
  }

  // Four tabs, two of which own a nested stack (`discover/_layout.tsx`,
  // `activity/_layout.tsx`). Drill-in screens used to be registered here as
  // `href: null` tabs, which made every `router.push()` a lateral tab switch:
  // no card transition, no swipe-back. They are stack children now, so this
  // layout only knows about the four things the tab bar actually shows.
  //
  // `popToTopOnBlur` on the two stack-owning tabs: leaving a tab resets its
  // stack. That matters most for the two create flows, which are modals that
  // finish with `router.replace('/activity')` — a tab jump does not unwind the
  // stack that presented them, so without this a submitted-and-left modal
  // stays presented over the tab the creator landed on. The cost is losing
  // your place in a drill-in when you tab away, which is one screen deep.
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
      }}>
      <Tabs.Screen
        name="discover"
        listeners={{ tabPress: onTabPress }}
        options={{
          title: 'Discover',
          popToTopOnBlur: true,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              name={{ ios: 'safari', android: 'explore', web: 'explore' }}
              filledName={{ ios: 'safari.fill', android: 'explore', web: 'explore' }}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        listeners={{ tabPress: onTabPress }}
        options={{
          title: 'Activity',
          popToTopOnBlur: true,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              name={{ ios: 'list.bullet.circle', android: 'checklist', web: 'checklist' }}
              filledName={{ ios: 'list.bullet.circle.fill', android: 'checklist', web: 'checklist' }}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings/index"
        listeners={{ tabPress: onTabPress }}
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              name={{ ios: 'dollarsign.circle', android: 'paid', web: 'paid' }}
              filledName={{ ios: 'dollarsign.circle.fill', android: 'paid', web: 'paid' }}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        listeners={{ tabPress: onTabPress }}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              name={{ ios: 'person.circle', android: 'person', web: 'person' }}
              filledName={{ ios: 'person.circle.fill', android: 'person', web: 'person' }}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  gateTitle: {
    textAlign: 'center',
  },
  gateBody: {
    textAlign: 'center',
    maxWidth: 320,
  },
  gateAction: {
    marginTop: Spacing.two,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
});
