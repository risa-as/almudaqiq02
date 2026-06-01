import { NextResponse } from 'next/server'

/** Returns true when the error is a database-unreachable / pool-timeout error */
export function isOfflineError(err: unknown): boolean {
  const msg  = (err as any)?.message ?? ''
  const code = (err as any)?.code    ?? ''
  return (
    code === 'P1001' || code === 'P1008' || code === 'P2024' ||
    msg.includes("Can't reach database") ||
    msg.includes('connection pool')      ||
    msg.includes('ECONNREFUSED')         ||
    msg.includes('Timed out fetching')
  )
}

/** Standard 503 JSON response used by all super-admin cloud routes when offline */
export function offlineResponse() {
  return NextResponse.json(
    { error: 'OFFLINE', message: 'لا يمكن الوصول إلى السحابة. تحقق من اتصالك بالإنترنت.' },
    { status: 503 }
  )
}

/**
 * Wraps a cloud-dependent route handler.
 * Returns a 503 offline response instead of throwing when the DB is unreachable.
 */
export async function withCloudDb(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler()
  } catch (err) {
    if (isOfflineError(err)) return offlineResponse()
    throw err
  }
}
