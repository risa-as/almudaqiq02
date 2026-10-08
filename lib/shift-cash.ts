/**
 * Cash a cashier's drawer should hold — ONE formula, used by both the live shift
 * summary (GET /api/shifts/close) and the close itself (POST). They used to
 * disagree: the summary ignored the cash part of SPLIT sales, and the close
 * ignored RETURNs, so the figure the cashier saw was not the one stored.
 *
 *  - SALE   CASH  → full total collected; SPLIT → its paidAmount (the cash part)
 *  - SALE   CARD / CREDIT → no cash
 *  - REFUND / RETURN → paidAmount is the cash handed back (credit-sale returns
 *    first cancel debt, so their paidAmount is only the remainder). Rows written
 *    before paidAmount was recorded on RETURNs fall back to |totalAmount|.
 */
export interface ShiftTx {
  type: string
  paymentMethod: string | null
  paidAmount: unknown
  totalAmount: unknown
}

export function summariseShiftCash(openingAmount: number, txs: ShiftTx[]) {
  let cashSales = 0, cardSales = 0, creditSales = 0, splitSales = 0
  let cashCollected = 0, cashRefunds = 0

  for (const tx of txs) {
    const total = Number(tx.totalAmount ?? 0)
    if (tx.type === 'SALE') {
      if (tx.paymentMethod === 'CASH')        { cashSales += total; cashCollected += total }
      else if (tx.paymentMethod === 'CARD')   cardSales += total
      else if (tx.paymentMethod === 'CREDIT') creditSales += total
      else if (tx.paymentMethod === 'SPLIT')  { splitSales += total; cashCollected += Number(tx.paidAmount ?? 0) }
    } else if ((tx.type === 'REFUND' || tx.type === 'RETURN') && (tx.paymentMethod ?? 'CASH') === 'CASH') {
      cashRefunds += tx.paidAmount != null ? Math.abs(Number(tx.paidAmount)) : Math.abs(total)
    }
  }

  return {
    cashSales, cardSales, creditSales, splitSales,
    cashCollected, cashRefunds,
    totalSales: cashSales + cardSales + creditSales + splitSales,
    expectedCash: openingAmount + cashCollected - cashRefunds,
  }
}
