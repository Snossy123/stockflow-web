import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { InvoiceDetailsDialog, InvoiceRefButton, type InvoiceViewTarget } from '../components/InvoiceDetailsDialog'
import { ItemFormDialog, specText } from '../components/ItemFormDialog'
import { DataTable, Dialog, Field, Money, PageBody, PageError, PageHeader } from '../components/ui'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, localIsoDate, money, statusLabel } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { ApproveEffect, Item, Purchase, Supplier } from '../lib/types'

type DraftLine = { itemId: number; qty: string; unitCost: string }

export function PurchasesPage() {
  const { can } = useAuth()
  const { isClosed, currentMonthClosed } = usePeriods()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [effect, setEffect] = useState<ApproveEffect | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [addItemForLine, setAddItemForLine] = useState<number | null>(null)
  const [detailTarget, setDetailTarget] = useState<InvoiceViewTarget | null>(null)
  const canAddItem = can('settings', 'create') || can('purchases', 'create') || can('sales', 'create')

  const [supplierId, setSupplierId] = useState(0)
  const [docDate, setDocDate] = useState(localIsoDate())
  const [paidNow, setPaidNow] = useState('0')
  const [lines, setLines] = useState<DraftLine[]>([{ itemId: 0, qty: '', unitCost: '' }])

  const purchaseItems = useMemo(
    () => items.filter((row) => row.categoryName !== 'فائض'),
    [items],
  )
  const purchaseTotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitCost || 0), 0),
    [lines],
  )
  const purchasesTable = useTableQuery(purchases, (row) =>
    searchText(row.no, row.supplierName, dateText(row.docDate), dateText(row.postingDate), statusLabel(row.status), row.total),
  )

  function reload() {
    void apiGet<Item[]>('/items').then((rows) => {
      setItems(rows)
      const nonSurplus = rows.filter((row) => row.categoryName !== 'فائض')
      setLines((current) => current.map((line) => (line.itemId ? line : { ...line, itemId: nonSurplus[0]?.id || rows[0]?.id || 0 })))
    })
    if (can('purchases', 'view')) {
      void apiGet<Purchase[]>('/purchases').then(setPurchases)
      void apiGet<Supplier[]>('/suppliers').then((rows) => {
        setSuppliers(rows)
        if (!supplierId && rows[0]) setSupplierId(rows[0].id)
      })
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      purchasesTable.setQuery(q)
    }
    const refId = Number(searchParams.get('refId'))
    if (!refId || purchases.length === 0) return
    const target = purchases.find((row) => row.id === refId)
    if (target) {
      purchasesTable.setQuery(target.no)
      setDetailTarget({ kind: 'purchase', data: target })
    } else {
      setDetailTarget({ kind: 'purchase', id: refId })
    }
  }, [searchParams, purchases])

  function clearRefParam() {
    if (!searchParams.has('refId')) return
    const next = new URLSearchParams(searchParams)
    next.delete('refId')
    setSearchParams(next, { replace: true })
  }

  function resetPurchase() {
    setLines([{ itemId: purchaseItems[0]?.id || items[0]?.id || 0, qty: '', unitCost: '' }])
    setPaidNow('0')
    setDocDate(localIsoDate())
  }

  return (
    <main>
      <PageHeader title="الواردات" />
      <PageError>{error}</PageError>
      <PageBody>
        {can('purchases', 'view') ? (
          <DataTable
            query={purchasesTable.query}
            onQueryChange={purchasesTable.setQuery}
            page={purchasesTable.page}
            pageCount={purchasesTable.pageCount}
            filteredCount={purchasesTable.filteredCount}
            totalCount={purchasesTable.totalCount}
            onPageChange={purchasesTable.setPage}
            emptyTitle="مفيش فواتير شراء"
            emptyHint="احفظ مسودة وبعدين اعتمدها عشان تدخل المخزون."
            toolbar={
              can('purchases', 'create') ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    resetPurchase()
                    setPurchaseOpen(true)
                  }}
                >
                  فاتورة شراء جديدة
                </button>
              ) : null
            }
          >
            <table className="table">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th>المورد</th>
                  <th>تاريخ المستند</th>
                  <th>تاريخ الترحيل</th>
                  <th>الحالة</th>
                  <th>الإجمالي</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {purchasesTable.pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="flex items-center gap-1 flex-wrap">
                        <InvoiceRefButton label={row.no} onClick={() => setDetailTarget({ kind: 'purchase', data: row })} />
                        {row.reversedOfId && row.reversedOfNo ? (
                          <button
                            type="button"
                            className="btn btn-ghost num text-xs"
                            title="عرض الفاتورة الأصلية"
                            onClick={() => setDetailTarget({ kind: 'purchase', id: row.reversedOfId! })}
                          >
                            (عكس {row.reversedOfNo})
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>{row.supplierName}</td>
                    <td className="num">{dateText(row.docDate)}</td>
                    <td className="num">{dateText(row.postingDate)}</td>
                    <td>
                      <span className={row.status === 'approved' ? 'tag tag-ok' : 'tag'}>{statusLabel(row.status)}</span>
                    </td>
                    <td>
                      <Money value={row.total} />
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setDetailTarget({ kind: 'purchase', data: row })}
                        >
                          التفاصيل
                        </button>
                        {row.status === 'draft' && can('purchases', 'approve') ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={currentMonthClosed}
                            onClick={() =>
                              apiPost<ApproveEffect>(`/purchases/${row.id}/approve`)
                                .then((res) => {
                                  setEffect(res)
                                  reload()
                                })
                                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الاعتماد'))
                            }
                          >
                            اعتماد
                          </button>
                        ) : row.status === 'approved' && can('purchases', 'approve') ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={isClosed(row.postingDate) || currentMonthClosed}
                            onClick={() =>
                              apiPost<ApproveEffect>(`/purchases/${row.id}/reverse`)
                                .then((res) => {
                                  setEffect(res)
                                  reload()
                                })
                                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل العكس'))
                            }
                          >
                            قيد عكسي
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : null}
      </PageBody>

      {purchaseOpen ? (
        <Dialog
          title="فاتورة شراء جديدة"
          size="xl"
          onClose={() => {
            setPurchaseOpen(false)
            resetPurchase()
          }}
        >
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <Field label="المورد">
              <select className="input" value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تاريخ المستند">
              <input className="input num" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </Field>
            <Field label="المدفوع الآن">
              <input className="input num" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} />
            </Field>
            <Field label="الباقي على الحساب">
              <div className="input num font-bold">{money(purchaseTotal - Number(paidNow || 0))}</div>
            </Field>
          </div>
          <table className="table text-sm">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>التصنيف</th>
                <th>الطول</th>
                <th>العرض</th>
                <th>التخانة</th>
                <th>الوحدة</th>
                <th>العدد</th>
                <th>التكلفة/وحدة</th>
                <th>الإجمالي</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const item = items.find((row) => row.id === line.itemId)
                return (
                  <tr key={index}>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <select
                          className="input"
                          value={line.itemId}
                          onChange={(e) =>
                            setLines((rows) =>
                              rows.map((row, i) => (i === index ? { ...row, itemId: Number(e.target.value) } : row)),
                            )
                          }
                        >
                          {purchaseItems.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.code} — {row.name}
                            </option>
                          ))}
                        </select>
                        {canAddItem ? (
                          <button
                            type="button"
                            className="btn btn-ghost shrink-0"
                            title="إضافة صنف جديد"
                            aria-label="إضافة صنف جديد"
                            onClick={() => setAddItemForLine(index)}
                          >
                            <Plus size={18} strokeWidth={1.75} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>{specText(item?.categoryName)}</td>
                    <td>{specText(item?.length)}</td>
                    <td>{specText(item?.width)}</td>
                    <td>{specText(item?.thickness)}</td>
                    <td>{specText(item?.unitName)}</td>
                    <td>
                      <input
                        className="input num"
                        value={line.qty}
                        onChange={(e) =>
                          setLines((rows) => rows.map((row, i) => (i === index ? { ...row, qty: e.target.value } : row)))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input num"
                        value={line.unitCost}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((row, i) => (i === index ? { ...row, unitCost: e.target.value } : row)),
                          )
                        }
                      />
                    </td>
                    <td className="num font-bold">{money(Number(line.qty || 0) * Number(line.unitCost || 0))}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setLines((rows) => rows.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="dialog-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setLines((rows) => [...rows, { itemId: purchaseItems[0]?.id || items[0]?.id || 0, qty: '', unitCost: '' }])}
            >
              + إضافة بند
            </button>
            <div className="flex items-center gap-4">
              <div>
                إجمالي الفاتورة <span className="num text-[22px] font-bold">{money(purchaseTotal)}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setError(null)
                  void apiPost<Purchase>('/purchases', {
                    supplierId,
                    docDate,
                    paidNow: Number(paidNow || 0),
                    items: lines
                      .filter((line) => line.itemId && Number(line.qty) > 0)
                      .map((line) => ({
                        itemId: line.itemId,
                        qty: Number(line.qty),
                        unitCost: Number(line.unitCost),
                      })),
                  })
                    .then(() => {
                      resetPurchase()
                      setPurchaseOpen(false)
                      reload()
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الحفظ'))
                }}
              >
                حفظ مسودة
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {addItemForLine != null ? (
        <ItemFormDialog
          showMinQty={false}
          showOpeningBalance
          onClose={() => setAddItemForLine(null)}
          onError={setError}
          onCreated={(item) => {
            setItems((current) => {
              if (current.some((row) => row.id === item.id)) return current.map((row) => (row.id === item.id ? item : row))
              return [...current, item]
            })
            setLines((rows) =>
              rows.map((row, i) => (i === addItemForLine ? { ...row, itemId: item.id } : row)),
            )
            setAddItemForLine(null)
          }}
        />
      ) : null}

      {effect ? (
        <Dialog title="أثر الاعتماد" onClose={() => setEffect(null)}>
          <p className="m-0 mb-4">{effect.message}</p>
          <ul className="m-0 mb-4 pr-4">
            {Object.entries(effect.numbers).map(([key, value]) => (
              <li key={key}>
                {key}: <span className="num font-bold">{money(value)}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onClick={() => setEffect(null)}>
            تمام
          </button>
        </Dialog>
      ) : null}

      <InvoiceDetailsDialog
        target={detailTarget}
        onClose={() => {
          setDetailTarget(null)
          clearRefParam()
        }}
        onSelectTarget={setDetailTarget}
      />
    </main>
  )
}
