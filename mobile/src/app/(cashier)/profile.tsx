import { AccountCard } from '@/components/AccountCard'
import { Hero } from '@/components/Hero'
import { Screen } from '@/components/Screen'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { greetingFor } from '@/utils/greeting'

export default function CashierProfile() {
  const user = useAuthStore(s => s.user)
  const brand = user?.tenantName || ar.appName

  return (
    <Screen title={ar.tabs.profile}>
      <Hero
        greeting={greetingFor(user?.username)}
        title={brand}
        icon="person"
        chips={[
          { icon: 'calendar-outline', text: formatDate(new Date()) },
          { icon: 'card-outline', text: 'كاشير' },
        ]}
      />
      <AccountCard />
    </Screen>
  )
}
