import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { RoleGate } from '@/components/RoleGate'
import { TabBarButton } from '@/components/TabBarButton'
import { ar } from '@/i18n/ar'
import { colors } from '@/theme'

export default function StockLayout() {
  return (
    <RoleGate allow={['STOCK_KEEPER']}>
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
          name="inventory"
          options={{
            title: ar.tabs.inventory,
            tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stocktake"
          options={{
            title: ar.tabs.stocktake,
            tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: ar.tabs.more,
            tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} />,
          }}
        />
        {/* شاشات خارج شريط التبويب — يُوصل إليها من "المزيد" */}
        <Tabs.Screen name="alerts" options={{ href: null }} />
        <Tabs.Screen name="suppliers" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  )
}
