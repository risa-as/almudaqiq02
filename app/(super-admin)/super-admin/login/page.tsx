'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * هذه الصفحة أصبحت مهجورة — تسجيل الدخول موحّد الآن في /login
 */
export default function SuperAdminLoginRedirect() {
  usePageTitle('تسجيل الدخول - المشرف');
  const router = useRouter()
  useEffect(() => { router.replace('/login') }, [router])
  return null
}
