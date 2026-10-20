const moneyFmt = new Intl.NumberFormat('ar-EG', {
  numberingSystem: 'latn',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const qtyFmt = new Intl.NumberFormat('ar-EG', {
  numberingSystem: 'latn',
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

export function money(value: number | null | undefined) {
  return moneyFmt.format(Number(value || 0))
}

export function qty(value: number | null | undefined) {
  return qtyFmt.format(Number(value || 0))
}

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

export function yearMonthKey(value?: string | Date | null) {
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return value
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 7)
  const date = value instanceof Date ? value : new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-')
  const name = MONTHS_AR[Number(month) - 1]
  if (!name) return yearMonth
  return `${name} ${year}`
}

export function localIsoDate(value?: Date) {
  const date = value ?? new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateText(value: string | null | undefined) {
  if (!value) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ar-EG', {
    numberingSystem: 'latn',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function timeText(value: string | null | undefined) {
  if (!value) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ar-EG', {
    numberingSystem: 'latn',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function dateTimeText(value: string | null | undefined) {
  if (!value) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) return dateText(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const d = new Intl.DateTimeFormat('ar-EG', {
    numberingSystem: 'latn',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
  const t = new Intl.DateTimeFormat('ar-EG', {
    numberingSystem: 'latn',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return `${d} · ${t}`
}

export function statusLabel(status: string) {
  if (status === 'draft') return 'مسودة'
  if (status === 'approved') return 'معتمدة'
  if (status === 'reversed') return 'عكسية'
  return status
}

export function kindLabel(kind: string) {
  if (kind === 'opening') return 'رصيد افتتاحي'
  if (kind === 'purchase') return 'شراء'
  if (kind === 'sale') return 'بيع'
  if (kind === 'waste') return 'هالك'
  if (kind === 'count_adj') return 'تسوية جرد'
  if (kind === 'surplus_in') return 'فائض متولد'
  if (kind === 'reversal') return 'قيد عكسي'
  if (kind === 'surplus') return 'فائض'
  if (kind === 'return') return 'مرتجع'
  if (kind === 'receipt') return 'استلام'
  if (kind === 'payment') return 'دفع'
  return kind
}

export function refTypeLabel(refType: string) {
  if (refType === 'purchase') return 'فاتورة شراء'
  if (refType === 'sale') return 'فاتورة بيع'
  if (refType === 'count') return 'جرد'
  if (refType === 'expense') return 'مصروف'
  if (refType === 'item') return 'رصيد صنف'
  return refType
}

