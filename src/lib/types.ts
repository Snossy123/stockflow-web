export type Permission = {
  resource: string
  action: string
}

export type Me = {
  id: number
  name: string
  username: string
  roleCode: string
  roleName: string
  permissions: Permission[]
}

export type ApiErrorBody = {
  message: string
  code?: string | null
}

export type Item = {
  id: number
  code: string
  name: string
  categoryId: number
  categoryName: string
  length: string | null
  width: string | null
  thickness: string | null
  unitId: number
  unitName: string
  minQty: number
  onHand: number
  avgCost: number
  stockValue: number
}

export type IdName = { id: number; name: string }

export type ExpenseType = { id: number; name: string; affectsStock: boolean }

export type Expense = {
  id: number
  typeId: number
  typeName: string
  affectsStock: boolean
  amount: number
  note: string | null
  occurredAt: string
  itemId: number | null
  itemName: string | null
  qty: number | null
  status: string
  stockCountId: number | null
  reversedOfId: number | null
}

export type PurchaseLine = {
  id: number
  itemId: number
  itemCode: string
  itemName: string
  categoryName: string
  length: string | null
  width: string | null
  thickness: string | null
  unitName: string
  qty: number
  unitCost: number
  total: number
}

export type Purchase = {
  id: number
  no: string
  supplierId: number
  supplierName: string
  docDate: string
  postingDate: string | null
  status: string
  paidNow: number
  remaining: number
  total: number
  items: PurchaseLine[]
}

export type SaleLine = {
  id: number
  itemId: number
  itemCode: string
  itemName: string
  unitName: string
  onHand: number
  lengthDesc: string | null
  boardLength: number | null
  cutLength: number | null
  qty: number
  unitPrice: number
  unitCost: number
  total: number
  surplusGenerated: boolean
  cut: boolean
  surplusItem: boolean
  returnableQty: number
  oversell: boolean
}

export type Sale = {
  id: number
  no: string
  customerId: number
  customerName: string
  docDate: string
  postingDate: string | null
  kind: string
  status: string
  paidNow: number
  remaining: number
  total: number
  cogs: number
  profit: number
  oversell: boolean
  reversedOfId: number | null
  reversedOfNo: string | null
  items: SaleLine[]
}

export type ApproveEffect = {
  message: string
  numbers: Record<string, number>
}

export type Supplier = {
  id: number
  name: string
  phone: string | null
  debt: number
  paid: number
  itemNames: string[]
}

export type Customer = {
  id: number
  name: string
  phone: string | null
  owed: number
  paid: number
  remaining: number
}

export type Payment = {
  id: number
  occurredAt: string
  amount: number
  method: string
  ref: string | null
  kind: string
}

export type StockRow = {
  itemId: number
  code: string
  name: string
  categoryName: string
  length: string | null
  width: string | null
  thickness: string | null
  unitName: string
  onHand: number
  avgCost: number
  stockValue: number
  status: string
}

export type Movement = {
  id: number
  occurredAt: string
  kind: string
  itemId: number
  itemName: string
  qtyIn: number
  qtyOut: number
  unitCost: number
  refType: string
  refId: number
  balanceAfter: number
}

export type CountLine = {
  id: number
  itemId: number
  itemName: string
  bookQty: number
  actualQty: number
  diff: number
  reason: string | null
}

export type StockCount = {
  id: number
  no: string
  status: string
  startedAt: string
  lines: CountLine[]
}

export type Dashboard = {
  kpis: { label: string; value: number; hint: string }[]
  purchaseNote: string
  recent: Movement[]
  alerts: { kind: string; message: string }[]
}

export type UserRow = {
  id: number
  name: string
  username: string
  phone: string | null
  status: string
  roleId: number
  roleCode: string
  roleName: string
  lastLoginAt: string | null
}

export type RoleMatrix = {
  id: number
  code: string
  name: string
  permissions: Permission[]
}

export type LoginEvent = {
  id: number
  username: string
  userName: string | null
  success: boolean
  occurredAt: string
}

export type AccountingPeriod = {
  yearMonth: string
  status: 'open' | 'closed' | string
  closedAt: string | null
  closedByName: string | null
  reopenedAt: string | null
  reopenedByName: string | null
}

export type PnlRow = {
  period: string
  revenue: number
  cogs: number
  gross: number
  expenses: number
  net: number
  closed: boolean
}

export type CashReport = {
  opening: number
  closing: number
  rows: { at: string; label: string; in: number; out: number; balance: number }[]
}

export type AgingReport = {
  customers: { partyName: string; d0: number; d31: number; d60: number }[]
  suppliers: { partyName: string; d0: number; d31: number; d60: number }[]
}

export type ItemProfitRow = {
  itemId: number
  itemName: string
  revenue: number
  cost: number
  profit: number
  margin: number
  weight: number
}

export type ReorderRow = {
  itemId: number
  itemName: string
  onHand: number
  minQty: number
  shortage: number
  weeklyUse: number
  suggested: number
  cheapestSupplierId: number | null
  cheapestSupplier: string | null
  cheapestCost: number | null
}
