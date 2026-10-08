import { prisma } from '@/lib/prisma'

/** Product/category ids must belong to the caller's tenant — Prisma's connect doesn't check. */
export async function foreignRef(tenantId: string, productId?: unknown, categoryId?: unknown): Promise<boolean> {
    const [p, c] = await Promise.all([
        productId  ? prisma.product.findFirst({ where: { id: String(productId), tenantId }, select: { id: true } })   : Promise.resolve(true),
        categoryId ? prisma.category.findFirst({ where: { id: String(categoryId), tenantId }, select: { id: true } }) : Promise.resolve(true),
    ])
    return !p || !c
}

const OFFER_TYPES = ['PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'BUY_X_GET_Y']

/** Rejects values that would make the POS discount more than the line is worth. */
export function invalidOfferValue(type: unknown, value: unknown): string | null {
    if (type !== undefined && !OFFER_TYPES.includes(String(type))) return 'نوع العرض غير صالح'
    if (value === undefined) return null
    const v = Number(value)
    if (!Number.isFinite(v) || v < 0) return 'قيمة العرض غير صالحة'
    if (type === 'PERCENTAGE_DISCOUNT' && v > 100) return 'نسبة الخصم لا تتجاوز 100%'
    return null
}
