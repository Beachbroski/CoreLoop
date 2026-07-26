import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type SymbolName = Parameters<typeof SymbolView>[0]['name'];

function TabIcon({ name, color }: { name: SymbolName; color: ColorValue }) {
  return <SymbolView name={name} size={24} tintColor={color as string} />;
}

export default function AppTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen
        name="discover/index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'safari', android: 'explore', web: 'explore' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity/index"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'list.bullet', android: 'checklist', web: 'checklist' }}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings/index"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'dollarsign.circle', android: 'paid', web: 'paid' }}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'person.circle', android: 'person', web: 'person' }} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
