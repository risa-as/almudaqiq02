import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-helpers'
import { guardFeature } from '@/lib/plan-features'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

async function findOwned(id: string, tenantId: string, userId: string) {
  return prisma.aiConversation.findFirst({ where: { id, tenantId, userId } })
}

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) return undefined
  try { return JSON.parse(raw) as T } catch { return undefined }
}

/** Fetch one conversation with its messages (for resuming). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = await guardFeature('ai_assistant'); if (blocked) return blocked

  const { id } = await params
  const conversation = await findOwned(id, auth.tenantId, auth.userId)
  if (!conversation) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  const messages = await prisma.aiMessage.findMany({
    where:   { conversationId: id },
    orderBy: { createdAt: 'asc' },
    take:    200,
  })

  return NextResponse.json({
    id:    conversation.id,
    title: conversation.title,
    messages: messages.map(m => ({
      id:           m.id,
      role:         m.role,
      content:      m.content,
      toolsInvoked: parseJson<string[]>(m.toolsInvoked),
      charts:       parseJson<unknown[]>(m.charts),
    })),
  })
}

/** Rename a conversation. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conversation = await findOwned(id, auth.tenantId, auth.userId)
  if (!conversation) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 80) : ''
  if (!title) return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 })

  await prisma.aiConversation.update({ where: { id }, data: { title } })
  return NextResponse.json({ success: true })
}

/** Delete a conversation and its messages. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conversation = await findOwned(id, auth.tenantId, auth.userId)
  if (!conversation) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  await prisma.aiConversation.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
