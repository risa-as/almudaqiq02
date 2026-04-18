'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * هذه الصفحة أصبحت مهجورة — تسجيل الدخول موحّد الآن في /login
 */
export default function SuperAdminLoginRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/login') }, [router])
  return null
}
