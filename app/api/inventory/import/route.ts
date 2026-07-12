import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
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

/** Flatten an exceljs cell value (rich text, formula result, hyperlink…) to a primitive. */
function cellToPrimitive(v: ExcelJS.CellValue): string | number {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string' || typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    if ('result' in v && v.result !== undefined) return cellToPrimitive(v.result as ExcelJS.CellValue)
    if ('richText' in v && Array.isArray(v.richText)) return v.richText.map(r => r.text).join('')
    if ('text' in v && typeof v.text === 'string') return v.text
  }
  return String(v)
}

/** Parse an .xlsx buffer into row objects keyed by the header row (like sheet_to_json). */
async function parseXlsx(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) return []

  const headers: string[] = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = normalize(cellToPrimitive(cell.value))
  })

  const rows: Record<string, unknown>[] = []
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const obj: Record<string, unknown> = {}
    let hasValue = false
    for (let c = 1; c < headers.length; c++) {
      if (!headers[c]) continue
      const val = cellToPrimitive(row.getCell(c).value)
      obj[headers[c]] = val
      if (val !== '') hasValue = true
    }
    if (hasValue) rows.push(obj)
  }
  return rows
}

/** Minimal CSV parser (quoted fields, commas, CRLF, UTF-8 BOM). */
function parseCsv(text: string): Record<string, unknown>[] {
  const clean = text.replace(/^﻿/, '')
  const lines: string[][] = []
  let field = '', row: string[] = [], inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) lines.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some(f => f.trim() !== '')) lines.push(row)

  if (lines.length < 2) return []
  const headers = lines[0].map(h => h.trim())
  return lines.slice(1).map(cells => {
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => { if (h) obj[h] = cells[i] ?? '' })
    return obj
  })
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

  const fileName = (file.name ?? '').toLowerCase()
  if (fileName.endsWith('.xls')) {
    return NextResponse.json(
      { error: 'صيغة .xls القديمة غير مدعومة — افتح الملف في Excel واحفظه بصيغة .xlsx ثم أعد الرفع' },
      { status: 400 }
    )
  }

  let rows: Record<string, unknown>[]
  try {
    rows = fileName.endsWith('.csv')
      ? parseCsv(buffer.toString('utf8'))
      : await parseXlsx(buffer)
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
