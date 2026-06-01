import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAuthContext } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function generateBarcode(): string {
  return `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

function normalize(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tenantId, branchId } = auth

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  let rows: Record<string, unknown>[]
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  } catch {
    return NextResponse.json({ error: 'فشل قراءة ملف Excel — تأكد من صحة تنسيق الملف' }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'الملف فارغ — لا توجد بيانات للاستيراد' }, { status: 400 })
  }

  // Determine target branch
  const firstBranch = await prisma.branch.findFirst({ where: { tenantId, isActive: true } })
  const targetBranchId = branchId && branchId !== 'all' ? branchId : firstBranch?.id

  // Cache of category/supplier names → ids (create if not exist)
  const catCache = new Map<string, string>()
  const supCache = new Map<string, string>()

  // Existing barcodes to prevent duplicates
  const existingBarcodes = new Set<string>(
    (await prisma.productUnit.findMany({ where: { product: { tenantId } }, select: { barcode: true } }))
      .map(u => u.barcode)
  )
  // Existing product names to prevent duplicates
  const existingNames = new Set<string>(
    (await prisma.product.findMany({ where: { tenantId }, select: { name: true } }))
      .map(p => p.name.trim().toLowerCase())
  )

  const results = { total: rows.length, created: 0, skipped: 0, errors: 0, errorDetails: [] as string[] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // Excel row (1=header)

    try {
      const name        = normalize(row['اسم المنتج'] ?? row['name'] ?? row['Name'])
      const unitName    = normalize(row['اسم الوحدة'] ?? row['unitName'] ?? '') || 'قطعة'
      const unitPrice   = toNum(row['سعر البيع'] ?? row['unitPrice'] ?? 0)
      const costPrice   = toNum(row['سعر الشراء'] ?? row['costPrice'] ?? 0)
      const conversion  = Math.max(1, Math.round(toNum(row['معامل التحويل'] ?? row['conversionFactor'] ?? 1)))
      const initQty     = Math.max(0, Math.round(toNum(row['الكمية الأولية'] ?? row['initialQuantity'] ?? 0)))
      const catName     = normalize(row['القسم'] ?? row['category'] ?? '')
      const supName     = normalize(row['المورد'] ?? row['supplier'] ?? '')
      let   barcode     = normalize(row['الباركود'] ?? row['barcode'] ?? '')

      if (!name) { results.skipped++; results.errorDetails.push(`السطر ${rowNum}: اسم المنتج فارغ — تم تخطيه`); continue }
      if (existingNames.has(name.toLowerCase())) { results.skipped++; results.errorDetails.push(`السطر ${rowNum}: "${name}" موجود مسبقاً — تم تخطيه`); continue }

      // Auto-generate barcode if missing or duplicate
      if (!barcode || existingBarcodes.has(barcode)) barcode = generateBarcode()
      existingBarcodes.add(barcode)

      // Resolve category
      let categoryId: string | null = null
      if (catName) {
        if (!catCache.has(catName)) {
          const cat = await prisma.category.upsert({
            where: { tenantId_name: { tenantId, name: catName } },
            create: { tenantId, name: catName },
            update: {},
          })
          catCache.set(catName, cat.id)
        }
        categoryId = catCache.get(catName)!
      }

      // Resolve supplier
      let supplierId: string | null = null
      if (supName) {
        if (!supCache.has(supName)) {
          let sup = await prisma.supplier.findFirst({ where: { tenantId, name: supName } })
          if (!sup) sup = await prisma.supplier.create({ data: { tenantId, name: supName } })
          supCache.set(supName, sup.id)
        }
        supplierId = supCache.get(supName)!
      }

      // costPrice in Excel = cost per SELLING unit (e.g. per carton).
      // product.costPrice must be cost per BASE unit so the transaction formula
      // (costPrice × conversionFactor × qty) stays correct.
      const costPerBaseUnit = conversion > 1 ? costPrice / conversion : costPrice

      // Create product + unit + initial batch in one transaction
      await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            tenantId,
            name,
            costPrice: costPerBaseUnit,
            categoryId,
            supplierId,
            baseStock: initQty * conversion,
          },
        })

        await tx.productUnit.create({
          data: {
            productId: product.id,
            tenantId,
            name:      unitName,
            price:     unitPrice,
            conversionFactor: conversion,
            barcode,
          },
        })

        if (initQty > 0 && targetBranchId) {
          await tx.productBatch.create({
            data: {
              tenantId,
              productId: product.id,
              branchId:  targetBranchId,
              quantity:  initQty * conversion,
              costPrice: costPerBaseUnit,
              batchNumber: 'IMPORT',
            },
          })
        }
      })

      existingNames.add(name.toLowerCase())
      results.created++
    } catch (err) {
      results.errors++
      results.errorDetails.push(`السطر ${rowNum}: خطأ — ${err instanceof Error ? err.message : 'خطأ غير معروف'}`)
    }
  }

  return NextResponse.json(results)
}
