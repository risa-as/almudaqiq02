import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { RoleGate } from '@/components/RoleGate'
import { TabBarButton } from '@/components/TabBarButton'
import { ar } from '@/i18n/ar'
import { colors } from '@/theme'

export default function CashierLayout() {
  return (
    <RoleGate allow={['CASHIER']}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarButton: props => <TabBarButton {...props} />,
        }}
      >
        <Tabs.Screen
          name="sell"
          options={{
            title: ar.tabs.sell,
            tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="shift"
          options={{
            title: ar.tabs.shift,
            tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="invoices"
          options={{
            title: ar.tabs.invoices,
            tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: ar.tabs.profile,
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>
    </RoleGate>
  )
}
