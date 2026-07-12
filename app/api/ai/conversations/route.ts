import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-helpers'
import { guardFeature } from '@/lib/plan-features'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

/** List the current user's AI conversations (most recent first). */
export async function GET(_request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = await guardFeature('ai_assistant'); if (blocked) return blocked

  const conversations = await prisma.aiConversation.findMany({
    where:   { tenantId: auth.tenantId, userId: auth.userId },
    orderBy: { updatedAt: 'desc' },
    take:    30,
    select:  {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json({
    conversations: conversations.map(c => ({
      id:            c.id,
      title:         c.title,
      updatedAt:     c.updatedAt,
      messagesCount: c._count.messages,
    })),
  })
}
