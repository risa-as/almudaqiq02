import { AccountCard } from '@/components/AccountCard'
import { Screen } from '@/components/Screen'
import { ar } from '@/i18n/ar'

export default function CashierProfile() {
  return (
    <Screen title={ar.tabs.profile}>
      <AccountCard />
    </Screen>
  )
}
