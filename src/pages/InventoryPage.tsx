import { ArrowUpLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { InvoiceDetailsDialog, InvoiceRefButton, type InvoiceViewTarget } from '../components/InvoiceDetailsDialog'
import { DataTable, Dialog, Money, PageBody, PageError, PageHeader, Tabs } from '../components/ui'
import { specText } from '../components/ItemFormDialog'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, kindLabel, money, qty, refTypeLabel } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { ApproveEffect, Item, Movement, StockCount, StockRow } from '../lib/types'

export function InventoryPage() {
  const { can } = useAuth()
  const { currentMonthClosed } = usePeriods()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'stock')
  const [stock, setStock] = useState<StockRow[]>([])
  const [moves, setMoves] = useState<Movement[]>([])
  const [counts, setCounts] = useState<StockCount[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [countOpen, setCountOpen] = useState(false)
  const [selectedCount, setSelectedCount] = useState<StockCount | null>(null)
  const [selectedStock, setSelectedStock] = useState<StockRow | null>(null)
  const [detailTarget, setDetailTarget] = useState<InvoiceViewTarget | null>(null)
  const [effect, setEffect] = useState<ApproveEffect | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actuals, setActuals] = useState<Record<number, string>>({})
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const stockTable = useTableQuery(stock, (row) =>
    searchText(row.code, row.name, row.categoryName, row.length, row.width, row.thickness, row.onHand, row.unitName, row.status),
  )
  const movesTable = useTableQuery(moves, (row) =>
    searchText(
      dateText(row.occurredAt),
      kindLabel(row.kind),
      row.itemName,
      row.qtyIn,
      row.qtyOut,
      row.refType,
      refTypeLabel(row.refType),
      row.refId,
      row.refNo,
    ),
  )
  const countsTable = useTableQuery(counts, (row) =>
    searchText(row.no, row.status === 'approved' ? 'معتمد' : 'مسودة', dateText(row.startedAt)),
  )

  function reload() {
    void apiGet<StockRow[]>('/inventory/on-hand').then(setStock)
    void apiGet<Movement[]>('/inventory/movements').then(setMoves)
    if (can('counts', 'view')) void apiGet<StockCount[]>('/inventory/counts').then(setCounts)
    void apiGet<Item[]>('/items').then(setItems)
  }

  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    if (requestedTab === 'stock' || requestedTab === 'moves' || (requestedTab === 'count' && can('counts', 'view'))) {
      setTab(requestedTab)
    }
  }, [searchParams, can])

  useEffect(() => {
    const refId = Number(searchParams.get('refId'))
    if (!refId) return
    const currentTab = searchParams.get('tab') || tab
    if (currentTab === 'count' && counts.length > 0) {
      const target = counts.find((row) => row.id === refId)
      if (target) {
        countsTable.setQuery(target.no)
        setSelectedCount(target)
      }
    } else if (currentTab === 'stock' && stock.length > 0) {
      const target = stock.find((row) => row.itemId === refId)
      if (target) {
        stockTable.setQuery(target.code)
        setSelectedStock(target)
      }
    }
  }, [searchParams, tab, counts, stock])

  function canOpenRef(refType: string) {
    if (refType === 'purchase') return can('purchases', 'view')
    if (refType === 'sale') return can('sales', 'view')
    if (refType === 'count') return can('counts', 'view')
    if (refType === 'expense') return can('expenses', 'view')
    if (refType === 'item') return can('settings', 'view') || can('inventory', 'view')
    return false
  }

  function openMovementRef(row: Movement) {
    if (row.refType === 'purchase') {
      navigate(`/purchases?refId=${row.refId}`)
    } else if (row.refType === 'sale') {
      navigate(`/revenue?refId=${row.refId}`)
    } else if (row.refType === 'count') {
      setTab('count')
      setSearchParams({ tab: 'count', refId: String(row.refId) })
    } else if (row.refType === 'expense') {
      navigate(`/expenses?refId=${row.refId}`)
    } else if (row.refType === 'item') {
      if (can('settings', 'view')) {
        navigate(`/settings?tab=items&refId=${row.refId}`)
      } else {
        setTab('stock')
        setSearchParams({ tab: 'stock', refId: String(row.refId) })
      }
    }
  }

  function clearRefParam() {
    if (!searchParams.has('refId')) return
    const next = new URLSearchParams(searchParams)
    next.delete('refId')
    setSearchParams(next, { replace: true })
  }

  const tabs = [
    { id: 'stock', label: 'الكميات الحالية' },
    { id: 'moves', label: 'حركة المخزون' },
    ...(can('counts', 'view') ? [{ id: 'count', label: 'الجرد' }] : []),
  ]

  return (
    <main>
      <PageHeader title="المخزون">
        <Tabs
          tabs={tabs}
          value={tab}
          onChange={(nextTab) => {
            setTab(nextTab)
            setSearchParams({ tab: nextTab }, { replace: true })
          }}
        />
      </PageHeader>
      <PageError>{error}</PageError>
      <PageBody>
        {tab === 'stock' ? (
            <DataTable
              query={stockTable.query}
              onQueryChange={stockTable.setQuery}
              page={stockTable.page}
              pageCount={stockTable.pageCount}
              filteredCount={stockTable.filteredCount}
              totalCount={stockTable.totalCount}
              onPageChange={stockTable.setPage}
              emptyHint="جرّب تشيل الفلتر أو اعتمد فاتورة شراء."
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>الكود</th>
                    <th>البيان</th>
                    <th>التصنيف</th>
                    <th>الطول</th>
                    <th>العرض</th>
                    <th>التخانة</th>
                    <th>متاح</th>
                    <th>متوسط التكلفة</th>
                    <th>قيمة المخزون</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {stockTable.pageRows.map((row) => (
                    <tr key={row.itemId}>
                      <td className="num">
                        <button
                          type="button"
                          className="btn btn-ghost num"
                          onClick={() => setSelectedStock(row)}
                        >
                          {row.code}
                        </button>
                      </td>
                      <td>{row.name}</td>
                      <td>{row.categoryName}</td>
                      <td>{specText(row.length)}</td>
                      <td>{specText(row.width)}</td>
                      <td>{specText(row.thickness)}</td>
                      <td className="num">
                        {qty(row.onHand)} {row.unitName}
                      </td>
                      <td>
                        <Money value={row.avgCost} />
                      </td>
                      <td>
                        <Money value={row.stockValue} />
                      </td>
                      <td>
                        <span className={row.status === 'منخفض' ? 'tag tag-accent' : 'tag tag-ok'}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
        ) : null}

        {tab === 'moves' ? (
            <DataTable
              query={movesTable.query}
              onQueryChange={movesTable.setQuery}
              page={movesTable.page}
              pageCount={movesTable.pageCount}
              filteredCount={movesTable.filteredCount}
              totalCount={movesTable.totalCount}
              onPageChange={movesTable.setPage}
              emptyTitle="مفيش حركات"
              emptyHint="الحركات بتتسجل أوتوماتيك من فواتير الشراء والبيع والهالك وتسويات الجرد."
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>النوع</th>
                    <th>الصنف</th>
                    <th>داخل</th>
                    <th>خارج</th>
                    <th>الرصيد بعدها</th>
                    <th>المرجع</th>
                  </tr>
                </thead>
                <tbody>
                  {movesTable.pageRows.map((row) => (
                    <tr key={row.id}>
                      <td className="num">{dateText(row.occurredAt)}</td>
                      <td>{kindLabel(row.kind)}</td>
                      <td>{row.itemName}</td>
                      <td className="num">{qty(row.qtyIn)}</td>
                      <td className="num">{qty(row.qtyOut)}</td>
                      <td className="num">{qty(row.balanceAfter)}</td>
                      <td>
                        {(row.refType === 'sale' || row.refType === 'purchase') && canOpenRef(row.refType) ? (
                          <InvoiceRefButton
                            label={row.refNo || `#${row.refId}`}
                            title={`عرض ${refTypeLabel(row.refType)}`}
                            onClick={() => setDetailTarget({ kind: row.refType as 'sale' | 'purchase', id: row.refId })}
                          />
                        ) : canOpenRef(row.refType) ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            title="عرض تفاصيل المصدر"
                            onClick={() => openMovementRef(row)}
                          >
                            <span>
                              {refTypeLabel(row.refType)} <span className="num">{row.refNo || `#${row.refId}`}</span>
                            </span>
                            <ArrowUpLeft size={14} strokeWidth={1.75} aria-hidden />
                          </button>
                        ) : (
                          <span>
                            {refTypeLabel(row.refType)} <span className="num">{row.refNo || `#${row.refId}`}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
        ) : null}

        {tab === 'count' && can('counts', 'view') ? (
          <DataTable
            query={countsTable.query}
            onQueryChange={countsTable.setQuery}
            page={countsTable.page}
            pageCount={countsTable.pageCount}
            filteredCount={countsTable.filteredCount}
            totalCount={countsTable.totalCount}
            onPageChange={countsTable.setPage}
            emptyTitle="مفيش جرد سابق"
            emptyHint="اعتمد جرد عشان تتسجل الفروقات في الحركة."
            toolbar={
              can('counts', 'create') ? (
                <button type="button" className="btn btn-primary" onClick={() => setCountOpen(true)}>
                  تسجيل جرد
                </button>
              ) : null
            }
          >
            <table className="table">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {countsTable.pageRows.map((row) => (
                  <tr key={row.id}>
                    <td className="num">
                      <button
                        type="button"
                        className="btn btn-ghost num"
                        onClick={() => setSelectedCount(row)}
                      >
                        {row.no}
                      </button>
                    </td>
                    <td>{row.status === 'approved' ? 'معتمد' : 'مسودة'}</td>
                    <td className="num">{dateText(row.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : null}
      </PageBody>

      {countOpen ? (
        <Dialog title="تسجيل فروقات الجرد" size="xl" onClose={() => setCountOpen(false)}>
          <table className="table mb-4">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الرصيد الدفتري</th>
                <th>الفعلي</th>
                <th>سبب العجز</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const actual = Number(actuals[item.id] ?? item.onHand)
                const shortage = actual < Number(item.onHand)
                return (
                  <tr key={item.id}>
                    <td>
                      {item.code} — {item.name}
                    </td>
                    <td className="num">{qty(item.onHand)}</td>
                    <td>
                      <input
                        className="input num"
                        value={actuals[item.id] ?? String(item.onHand)}
                        onChange={(e) => setActuals((current) => ({ ...current, [item.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      {shortage ? (
                        <input
                          className="input"
                          value={reasons[item.id] || ''}
                          placeholder="سبب العجز"
                          onChange={(e) => setReasons((current) => ({ ...current, [item.id]: e.target.value }))}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="dialog-foot">
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                !can('counts', 'approve') ||
                currentMonthClosed ||
                items.some((item) => {
                  const actual = Number(actuals[item.id] ?? item.onHand)
                  return actual < Number(item.onHand) && !(reasons[item.id] || '').trim()
                })
              }
              onClick={() => {
                setError(null)
                void apiPost<StockCount>('/inventory/counts', {
                  lines: items.map((item) => ({
                    itemId: item.id,
                    actualQty: Number(actuals[item.id] ?? item.onHand),
                    reason: (reasons[item.id] || '').trim() || null,
                  })),
                })
                  .then((count) => apiPost<ApproveEffect>(`/inventory/counts/${count.id}/approve`))
                  .then((res) => {
                    setEffect(res)
                    setReasons({})
                    setCountOpen(false)
                    reload()
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الجرد'))
              }}
            >
              اعتماد الجرد
            </button>
            {currentMonthClosed ? (
              <p className="m-0 text-sm text-[var(--color-accent-700)]">
                الفترة الحالية مقفولة. اعتماد الجرد واقف لحد ما تتفتح.
              </p>
            ) : null}
          </div>
        </Dialog>
      ) : null}

      {selectedCount ? (
        <Dialog
          title={`تفاصيل جرد ${selectedCount.no}`}
          size="xl"
          onClose={() => {
            setSelectedCount(null)
            clearRefParam()
          }}
        >
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div className="card">
              <div className="text-xs text-[var(--color-muted)]">رقم الجرد</div>
              <div className="num font-bold">{selectedCount.no}</div>
            </div>
            <div className="card">
              <div className="text-xs text-[var(--color-muted)]">التاريخ</div>
              <div className="num font-bold">{dateText(selectedCount.startedAt)}</div>
            </div>
            <div className="card">
              <div className="text-xs text-[var(--color-muted)]">الحالة</div>
              <div>
                <span className={selectedCount.status === 'approved' ? 'tag tag-ok' : 'tag'}>
                  {selectedCount.status === 'approved' ? 'معتمد' : 'مسودة'}
                </span>
              </div>
            </div>
          </div>
          <table className="table mb-4">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الرصيد الدفتري</th>
                <th>الفعلي</th>
                <th>الفرق</th>
                <th>سبب العجز</th>
              </tr>
            </thead>
            <tbody>
              {selectedCount.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.itemName}</td>
                  <td className="num">{qty(line.bookQty)}</td>
                  <td className="num">{qty(line.actualQty)}</td>
                  <td
                    className={`num font-bold ${
                      Number(line.diff) < 0 ? 'text-[var(--color-accent-700)]' : ''
                    }`}
                  >
                    {Number(line.diff) > 0 ? `+${qty(line.diff)}` : qty(line.diff)}
                  </td>
                  <td>{line.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dialog-foot">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setSelectedCount(null)
                clearRefParam()
              }}
            >
              إغلاق
            </button>
          </div>
        </Dialog>
      ) : null}

      {selectedStock ? (
        <Dialog
          title={`تفاصيل صنف ${selectedStock.code}`}
          onClose={() => {
            setSelectedStock(null)
            clearRefParam()
          }}
        >
          <dl className="card grid gap-3 m-0 mb-4">
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">الكود</dt>
              <dd className="m-0 num font-bold">{selectedStock.code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">البيان</dt>
              <dd className="m-0 font-bold">{selectedStock.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">التصنيف</dt>
              <dd className="m-0">{selectedStock.categoryName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">المقاسات (طول × عرض × تخانة)</dt>
              <dd className="m-0 num">
                {specText(selectedStock.length)} × {specText(selectedStock.width)} × {specText(selectedStock.thickness)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">المتاح حالياً</dt>
              <dd className="m-0 num font-bold">
                {qty(selectedStock.onHand)} {selectedStock.unitName}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">متوسط التكلفة</dt>
              <dd className="m-0 num font-bold">{money(selectedStock.avgCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">قيمة المخزون</dt>
              <dd className="m-0 num font-bold">{money(selectedStock.stockValue)}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelectedStock(null)
              clearRefParam()
            }}
          >
            إغلاق
          </button>
        </Dialog>
      ) : null}

      {effect ? (
        <Dialog title="أثر الجرد" onClose={() => setEffect(null)}>
          <p>{effect.message}</p>
          <p>
            عجز جرد <span className="num font-bold">{money(effect.numbers.waste || 0)}</span> — زيادة{' '}
            <span className="num font-bold">{money(effect.numbers.surplus || 0)}</span>
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setEffect(null)}>
            تمام
          </button>
        </Dialog>
      ) : null}

      <InvoiceDetailsDialog
        target={detailTarget}
        onClose={() => setDetailTarget(null)}
        onSelectTarget={setDetailTarget}
      />
    </main>
  )
}
