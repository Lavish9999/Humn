import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors } from '../../src/theme';

const Icon = ({
  label,
  color,
}: {
  label: string;
  color: ColorValue;
}) => (
  <Text style={{ color, fontSize: 10, fontWeight: '800' }}>
    {label}
  </Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 82,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <Icon label="DISC" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Icon label="FIND" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <Icon label="MAKE" color={color} />,
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: 'Collections',
          tabBarIcon: ({ color }) => <Icon label="SAVE" color={color} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <Icon label="YOU" color={color} />,
        }}
      />
    </Tabs>
  );
}
