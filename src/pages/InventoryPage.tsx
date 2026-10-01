import { useEffect, useState } from 'react'
import { DataTable, Dialog, Money, PageBody, PageError, PageHeader, Tabs } from '../components/ui'
import { specText } from '../components/ItemFormDialog'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, kindLabel, money, qty } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { ApproveEffect, Item, Movement, StockCount, StockRow } from '../lib/types'

export function InventoryPage() {
  const { can } = useAuth()
  const { currentMonthClosed } = usePeriods()
  const [tab, setTab] = useState('stock')
  const [stock, setStock] = useState<StockRow[]>([])
  const [moves, setMoves] = useState<Movement[]>([])
  const [counts, setCounts] = useState<StockCount[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [countOpen, setCountOpen] = useState(false)
  const [effect, setEffect] = useState<ApproveEffect | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actuals, setActuals] = useState<Record<number, string>>({})
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const stockTable = useTableQuery(stock, (row) =>
    searchText(row.code, row.name, row.categoryName, row.length, row.width, row.thickness, row.onHand, row.unitName, row.status),
  )
  const movesTable = useTableQuery(moves, (row) =>
    searchText(dateText(row.occurredAt), kindLabel(row.kind), row.itemName, row.qtyIn, row.qtyOut, row.refType, row.refId),
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

  const tabs = [
    { id: 'stock', label: 'الكميات الحالية' },
    { id: 'moves', label: 'حركة المخزون' },
    ...(can('counts', 'view') ? [{ id: 'count', label: 'الجرد' }] : []),
  ]

  return (
    <main>
      <PageHeader title="المخزون">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
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
                      <td className="num">{row.code}</td>
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
                        {row.refType} #{row.refId}
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
                    <td className="num">{row.no}</td>
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
    </main>
  )
}
