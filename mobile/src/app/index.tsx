import { Redirect } from 'expo-router'
import { LoadingView } from '@/components/LoadingView'
import { homePathForRole, useAuthStore } from '@/stores/auth'

export default function Index() {
  const status = useAuthStore(s => s.status)
  const user = useAuthStore(s => s.user)

  if (status === 'booting') return <LoadingView />
  if (status !== 'signedIn' || !user) return <Redirect href="/login" />
  return <Redirect href={homePathForRole(user.role) as never} />
}
