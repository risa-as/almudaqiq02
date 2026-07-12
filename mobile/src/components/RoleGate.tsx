import type { PropsWithChildren } from 'react'
import { Redirect } from 'expo-router'
import type { Role } from '@/api/endpoints/auth'
import { LoadingView } from '@/components/LoadingView'
import { homePathForRole, useAuthStore } from '@/stores/auth'

/**
 * حارس مجموعة المسارات: يمنع الوصول لواجهة دور آخر حتى عبر الروابط العميقة
 * (FR-007). كل _layout لمجموعة يلفّ محتواه به.
 */
export function RoleGate({ allow, children }: PropsWithChildren<{ allow: Role[] }>) {
  const status = useAuthStore(s => s.status)
  const user = useAuthStore(s => s.user)

  if (status === 'booting') return <LoadingView />
  if (status !== 'signedIn' || !user) return <Redirect href="/login" />
  if (!allow.includes(user.role)) return <Redirect href={homePathForRole(user.role) as never} />
  return <>{children}</>
}
