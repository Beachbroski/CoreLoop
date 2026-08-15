import { useAuth } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useTheme } from '@/hooks/use-theme';

type SymbolName = Parameters<typeof SymbolView>[0]['name'];

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

  usePushNotifications();

  // Defense in depth: a deep link could land here directly, bypassing the
  // root index redirect.
  if (isLoaded && !isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
      }}>
      <Tabs.Screen
        name="discover/index"
        listeners={{ tabPress: onTabPress }}
        options={{
          title: 'Discover',
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
        name="activity/index"
        listeners={{ tabPress: onTabPress }}
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              name={{ ios: 'list.bullet', android: 'checklist', web: 'checklist' }}
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

      {/* Nested detail/form screens — reachable via router.push(), not tabs. */}
      <Tabs.Screen name="discover/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="discover/[id]/apply" options={{ href: null }} />
      <Tabs.Screen name="activity/applications/[id]" options={{ href: null }} />
      <Tabs.Screen name="activity/submissions/[id]" options={{ href: null }} />
      <Tabs.Screen name="activity/submissions/new" options={{ href: null }} />
    </Tabs>
  );
}
