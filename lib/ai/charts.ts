/**
 * Turns raw tool results into compact chart payloads the chat UI can render.
 * Only tools whose results have an obvious visual shape produce a chart.
 */

export interface MessageChart {
  kind: 'area' | 'bar' | 'pie'
  title: string
  data: { label: string; value: number }[]
}

const MAX_POINTS = 30

function points(rows: any[], label: (r: any) => string, value: (r: any) => number) {
  return rows.slice(0, MAX_POINTS).map(r => ({ label: label(r), value: Math.round(value(r) * 100) / 100 }))
}

export function extractChart(toolName: string, result: any): MessageChart | null {
  if (!result || typeof result !== 'object' || (result as any).error) return null
  try {
    switch (toolName) {
      case 'get_sales_report': {
        const days = (result as any).by_day
        if (Array.isArray(days) && days.length > 1) {
          return { kind: 'area', title: 'الإيراد اليومي', data: points(days, d => d.date, d => d.revenue) }
        }
        return null
      }
      case 'get_hourly_heatmap': {
        const hours = (result as any).hours
        if (Array.isArray(hours) && hours.length) {
          const operating = hours.filter((h: any) => h.hour >= 6 && h.hour <= 23)
          return { kind: 'bar', title: 'المعاملات حسب الساعة', data: points(operating, h => h.label, h => h.count) }
        }
        return null
      }
      case 'get_branch_stats': {
        const branches = (result as any).branches
        if (Array.isArray(branches) && branches.length > 1) {
          return { kind: 'bar', title: 'إيراد الفروع', data: points(branches, b => b.name, b => b.total_revenue) }
        }
        return null
      }
      case 'get_branch_profit_detail': {
        const branches = (result as any).branches
        if (Array.isArray(branches) && branches.length > 1) {
          return { kind: 'bar', title: 'صافي ربح الفروع', data: points(branches, b => b.name, b => b.net_profit) }
        }
        return null
      }
      case 'get_top_products': {
        const products = (result as any).products
        if (Array.isArray(products) && products.length > 1) {
          return { kind: 'bar', title: 'أعلى المنتجات إيراداً', data: points(products.slice(0, 8), p => p.name, p => p.revenue) }
        }
        return null
      }
      case 'get_product_margins': {
        const products = (result as any).products
        if (Array.isArray(products) && products.length > 1) {
          return { kind: 'bar', title: 'إجمالي الربح حسب المنتج', data: points(products.slice(0, 8), p => p.name, p => p.gross_profit) }
        }
        return null
      }
      case 'get_expense_breakdown': {
        const cats = (result as any).by_category
        if (Array.isArray(cats) && cats.length > 1) {
          return { kind: 'pie', title: 'المصاريف حسب الفئة', data: points(cats.slice(0, 8), c => c.category, c => c.amount) }
        }
        return null
      }
      default:
        return null
    }
  } catch {
    return null
  }
}
