import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { RoleGate } from '@/components/RoleGate'
import { TabBarButton } from '@/components/TabBarButton'
import { ar } from '@/i18n/ar'
import { colors } from '@/theme'

export default function AdminLayout() {
  return (
    <RoleGate allow={['ADMIN', 'BRANCH_MANAGER']}>
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
          name="dashboard"
          options={{
            title: ar.tabs.dashboard,
            tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="sales"
          options={{
            title: ar.tabs.sales,
            tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: ar.tabs.reports,
            tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: ar.tabs.more,
            tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} />,
          }}
        />
        {/* شاشات خارج شريط التبويب — يُوصل إليها من الرئيسية/المزيد */}
        <Tabs.Screen name="inventory" options={{ href: null }} />
        <Tabs.Screen name="approvals" options={{ href: null }} />
        <Tabs.Screen name="users" options={{ href: null }} />
        <Tabs.Screen name="assistant" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  )
}
