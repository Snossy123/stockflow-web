import { Fragment, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { InvoiceDetailsDialog, InvoiceRefButton, type InvoiceViewTarget } from '../components/InvoiceDetailsDialog'
import { ItemFormDialog, specText } from '../components/ItemFormDialog'
import { DataTable, Dialog, Field, Money, PageBody, PageError, PageHeader } from '../components/ui'
import { apiGet, apiPost, apiPut } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, localIsoDate, money, qty, statusLabel } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { ApproveEffect, Customer, Item, Sale } from '../lib/types'

type DraftLine = {
  itemId: number
  qty: string
  unitPrice: string
  boardLength: string
  cutLength: string
  lengthDesc: string
}

type ApproveChoice = { cut: boolean; cutQty: string; surplus: boolean }
type ReturnQty = Record<number, string>

function emptyLine(itemId = 0): DraftLine {
  return { itemId, qty: '', unitPrice: '', boardLength: '5', cutLength: '4', lengthDesc: '4.00 م' }
}

export function RevenuePage() {
  const { can } = useAuth()
  const { currentMonthClosed } = usePeriods()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [effect, setEffect] = useState<ApproveEffect | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState(0)
  const [docDate, setDocDate] = useState(localIsoDate())
  const [paidNow, setPaidNow] = useState('0')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [approveSale, setApproveSale] = useState<Sale | null>(null)
  const [approveChoices, setApproveChoices] = useState<Record<number, ApproveChoice>>({})
  const [returnSale, setReturnSale] = useState<Sale | null>(null)
  const [returnQtys, setReturnQtys] = useState<ReturnQty>({})
  const [receivedNow, setReceivedNow] = useState('0')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [saleOpen, setSaleOpen] = useState(false)
  const [addItemForLine, setAddItemForLine] = useState<number | null>(null)
  const [detailTarget, setDetailTarget] = useState<InvoiceViewTarget | null>(null)
  const canAddItem = can('settings', 'create') || can('purchases', 'create') || can('sales', 'create')
  const salesTable = useTableQuery(sales, (row) =>
    searchText(
      row.no,
      row.customerName,
      dateText(row.docDate),
      dateText(row.postingDate),
      row.kind === 'return' ? `مرتجع${row.reversedOfNo ? ` ${row.reversedOfNo}` : ''}` : 'بيع',
      row.total,
      statusLabel(row.status),
    ),
  )

  function resetForm(nextItems = items) {
    setEditingId(null)
    setCustomerId(customers[0]?.id || 0)
    setDocDate(localIsoDate())
    setPaidNow('0')
    setLines([emptyLine(nextItems[0]?.id || 0)])
  }

  function closeSale() {
    setSaleOpen(false)
    resetForm()
  }

  function loadDraft(row: Sale) {
    setEditingId(row.id)
    setCustomerId(row.customerId)
    setDocDate(row.docDate)
    setPaidNow(String(row.paidNow || 0))
    setLines(
      row.items.length
        ? row.items.map((line) => ({
            itemId: line.itemId,
            qty: String(line.qty),
            unitPrice: String(line.unitPrice),
            boardLength: line.boardLength != null ? String(line.boardLength) : '',
            cutLength: line.cutLength != null ? String(line.cutLength) : '',
            lengthDesc: line.lengthDesc || '',
          }))
        : [emptyLine(items[0]?.id || 0)],
    )
    setSaleOpen(true)
  }

  function reload() {
    if (can('sales', 'view')) void apiGet<Sale[]>('/sales').then(setSales)
    if (can('customers', 'view')) {
      void apiGet<Customer[]>('/customers').then((rows) => {
        setCustomers(rows)
        if (!customerId && rows[0]) setCustomerId(rows[0].id)
      })
    }
    void apiGet<Item[]>('/items').then((rows) => {
      setItems(rows)
      setLines((current) => current.map((line) => (line.itemId ? line : { ...line, itemId: rows[0]?.id || 0 })))
    })
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      salesTable.setQuery(q)
    }
    const refId = Number(searchParams.get('refId'))
    if (!refId || sales.length === 0) return
    const target = sales.find((row) => row.id === refId)
    if (target) {
      salesTable.setQuery(target.no)
      setDetailTarget({ kind: 'sale', data: target })
    } else {
      setDetailTarget({ kind: 'sale', id: refId })
    }
  }, [searchParams, sales])

  function clearRefParam() {
    if (!searchParams.has('refId')) return
    const next = new URLSearchParams(searchParams)
    next.delete('refId')
    setSearchParams(next, { replace: true })
  }

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0), 0),
    [lines],
  )
  const oversell = lines.some((line) => {
    const item = items.find((row) => row.id === line.itemId)
    return item ? Number(line.qty || 0) > Number(item.onHand) : false
  })
  const selectableItems = items.filter((item) => item.categoryName !== 'فائض' || Number(item.onHand) > 0)

  function salePayload() {
    return {
      customerId,
      docDate,
      paidNow: Number(paidNow || 0),
      items: lines
        .filter((line) => line.itemId && Number(line.qty) > 0)
        .map((line) => ({
          itemId: line.itemId,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          boardLength: Number(line.boardLength || 0) || null,
          cutLength: Number(line.cutLength || 0) || null,
          lengthDesc: line.lengthDesc,
        })),
    }
  }

  function saveDraft() {
    setError(null)
    const request = editingId
      ? apiPut<Sale>(`/sales/${editingId}`, salePayload())
      : apiPost<Sale>('/sales', salePayload())
    void request
      .then(() => {
        closeSale()
        reload()
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الحفظ'))
  }

  function openApprove(row: Sale) {
    setApproveSale(row)
    const next: Record<number, ApproveChoice> = {}
    row.items.forEach((line) => {
      next[line.id] = { cut: false, cutQty: String(line.qty), surplus: false }
    })
    setApproveChoices(next)
  }

  const invalidCutQty = useMemo(() => {
    if (!approveSale) return false
    return approveSale.items.some((line) => {
      if (line.surplusItem) return false
      const choice = approveChoices[line.id]
      if (!choice?.cut) return false
      const val = Number(choice.cutQty || 0)
      return !Number.isFinite(val) || val <= 0 || val > Number(line.qty)
    })
  }, [approveSale, approveChoices])

  function submitApprove() {
    if (!approveSale) return
    setError(null)
    void apiPost<ApproveEffect>(`/sales/${approveSale.id}/approve`, {
      lines: approveSale.items
        .filter((line) => !line.surplusItem)
        .map((line) => {
          const choice = approveChoices[line.id]
          const cut = choice?.cut || false
          return {
            lineId: line.id,
            cut,
            cutQty: cut ? Number(choice?.cutQty || 0) : 0,
            surplus: cut ? choice?.surplus || false : false,
          }
        }),
    })
      .then((res) => {
        setApproveSale(null)
        setEffect(res)
        reload()
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الاعتماد'))
  }

  function openReturn(row: Sale) {
    setReturnSale(row)
    const next: ReturnQty = {}
    row.items.forEach((line) => {
      next[line.id] = line.returnableQty <= 0 ? '0' : String(line.returnableQty)
    })
    setReturnQtys(next)
    setReceivedNow('0')
  }

  function submitReturn() {
    if (!returnSale) return
    setError(null)
    void apiPost<ApproveEffect>(`/sales/${returnSale.id}/return`, {
      receivedNow: Number(receivedNow || 0),
      items: returnSale.items
        .filter((line) => Number(returnQtys[line.id] || 0) > 0)
        .map((line) => ({ lineId: line.id, qty: Number(returnQtys[line.id]) })),
    })
      .then((res) => {
        setReturnSale(null)
        setEffect(res)
        reload()
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل المرتجع'))
  }

  return (
    <main>
      <PageHeader title="الصادرات" />
      <PageError>{error}</PageError>
      <PageBody>
        <DataTable
          query={salesTable.query}
          onQueryChange={salesTable.setQuery}
          page={salesTable.page}
          pageCount={salesTable.pageCount}
          filteredCount={salesTable.filteredCount}
          totalCount={salesTable.totalCount}
          onPageChange={salesTable.setPage}
          emptyTitle="مفيش فواتير بيع"
          emptyHint="احفظ مسودة وبعدين اعتمد الخصم من المخزون."
          toolbar={
            can('sales', 'create') ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  resetForm()
                  setSaleOpen(true)
                }}
              >
                فاتورة بيع جديدة
              </button>
            ) : null
          }
        >
            <table className="table">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th>العميل</th>
                  <th>تاريخ المستند</th>
                  <th>تاريخ الترحيل</th>
                  <th>النوع</th>
                  <th>الإجمالي</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {salesTable.pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <InvoiceRefButton label={row.no} onClick={() => setDetailTarget({ kind: 'sale', data: row })} />
                    </td>
                    <td>{row.customerName}</td>
                    <td className="num">{dateText(row.docDate)}</td>
                    <td className="num">{dateText(row.postingDate)}</td>
                    <td>
                      {row.kind === 'return' ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span>مرتجع</span>
                          {row.reversedOfId && row.reversedOfNo ? (
                            <InvoiceRefButton
                              label={row.reversedOfNo}
                              title="عرض الفاتورة الأصلية"
                              onClick={() => setDetailTarget({ kind: 'sale', id: row.reversedOfId! })}
                            />
                          ) : row.reversedOfNo ? (
                            <span className="num">{row.reversedOfNo}</span>
                          ) : null}
                        </div>
                      ) : (
                        'بيع'
                      )}
                    </td>
                    <td>
                      <Money value={row.total} />
                    </td>
                    <td>
                      <span className={row.status === 'approved' ? 'tag tag-ok' : 'tag'}>{statusLabel(row.status)}</span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setDetailTarget({ kind: 'sale', data: row })}
                        >
                          التفاصيل
                        </button>
                        {row.status === 'draft' && can('sales', 'create') ? (
                          <button type="button" className="btn btn-secondary" onClick={() => loadDraft(row)}>
                            تعديل
                          </button>
                        ) : null}
                        {row.status === 'draft' && can('sales', 'approve') ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={row.oversell || currentMonthClosed}
                            onClick={() => openApprove(row)}
                          >
                            اعتماد وخصم من المخزون
                          </button>
                        ) : null}
                        {row.status === 'approved' &&
                        row.kind === 'sale' &&
                        can('sales', 'approve') &&
                        row.items.some((line) => Number(line.returnableQty) > 0) ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={currentMonthClosed}
                            onClick={() => openReturn(row)}
                          >
                            مرتجع
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </DataTable>
      </PageBody>

      {saleOpen ? (
        <Dialog
          title={editingId ? `تعديل مسودة ${sales.find((row) => row.id === editingId)?.no || ''}` : 'فاتورة بيع جديدة'}
          size="xl"
          onClose={closeSale}
        >
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <Field label="العميل">
              <select className="input" value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))}>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تاريخ المستند">
              <input className="input num" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </Field>
            <Field label="المستلم الآن">
              <input className="input num" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} />
            </Field>
            <Field label="الباقي على العميل">
              <div className="input num font-bold">{money(total - Number(paidNow || 0))}</div>
            </Field>
          </div>
          <table className="table text-sm">
            <thead>
              <tr>
                <th>الصنف من المخزون</th>
                <th>التصنيف</th>
                <th>الطول</th>
                <th>العرض</th>
                <th>التخانة</th>
                <th>الوحدة</th>
                <th>المتاح</th>
                <th>طول اللوح</th>
                <th>المقطوع</th>
                <th>العدد</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const item = items.find((row) => row.id === line.itemId)
                const surplusItem = item?.categoryName === 'فائض'
                const lineOver = item ? Number(line.qty || 0) > Number(item.onHand) : false
                return (
                  <Fragment key={index}>
                    <tr>
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
                            {selectableItems.map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.categoryName === 'فائض' ? `فائض — ${row.code} — ${row.name}` : `${row.code} — ${row.name}`}
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
                      <td className={`num ${lineOver ? 'text-[var(--color-accent-700)] font-bold' : ''}`}>
                        {qty(item?.onHand)}
                      </td>
                      <td>
                        {surplusItem ? (
                          '—'
                        ) : (
                          <input
                            className="input num"
                            value={line.boardLength}
                            onChange={(e) =>
                              setLines((rows) =>
                                rows.map((row, i) => (i === index ? { ...row, boardLength: e.target.value } : row)),
                              )
                            }
                          />
                        )}
                      </td>
                      <td>
                        {surplusItem ? (
                          '—'
                        ) : (
                          <input
                            className="input num"
                            value={line.cutLength}
                            onChange={(e) =>
                              setLines((rows) =>
                                rows.map((row, i) =>
                                  i === index
                                    ? { ...row, cutLength: e.target.value, lengthDesc: `${e.target.value} م` }
                                    : row,
                                ),
                              )
                            }
                          />
                        )}
                      </td>
                      <td>
                        <input
                          className="input num"
                          value={line.qty}
                          onChange={(e) =>
                            setLines((rows) =>
                              rows.map((row, i) => (i === index ? { ...row, qty: e.target.value } : row)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input num"
                          value={line.unitPrice}
                          onChange={(e) =>
                            setLines((rows) =>
                              rows.map((row, i) => (i === index ? { ...row, unitPrice: e.target.value } : row)),
                            )
                          }
                        />
                      </td>
                      <td className="num font-bold">{money(Number(line.qty || 0) * Number(line.unitPrice || 0))}</td>
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
                    {lineOver ? (
                      <tr className="warn-row">
                        <td colSpan={13}>المطلوب أكبر من المتاح. عدّل العدد أو سجّل فاتورة شراء قبل الاعتماد.</td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <div className="dialog-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setLines((rows) => [...rows, emptyLine(selectableItems[0]?.id || 0)])}
            >
              + إضافة بند
            </button>
            <div className="flex items-center gap-4">
              {oversell ? (
                <span className="text-sm font-semibold text-[var(--color-accent-700)]">
                  في بنود أكبر من المتاح — الاعتماد هيتقفل لحد ما تعدّل العدد
                </span>
              ) : null}
              <div>
                السعر النهائي <span className="num text-[22px] font-bold">{money(total)}</span>
              </div>
              {editingId ? (
                <button type="button" className="btn btn-secondary" onClick={closeSale}>
                  إلغاء التعديل
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={saveDraft}>
                {editingId ? 'حفظ التعديل' : 'حفظ مسودة'}
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

      {approveSale ? (
        <Dialog title={`اعتماد ${approveSale.no}`} size="xl" onClose={() => setApproveSale(null)}>
          <p className="m-0 mb-4">
            أكد القص وعدد الألواح المقصوصة والفائض لكل بند خشب. الألواح المقصوصة مش هترجع، والفائض بيتسجل بنفس اسم الصنف
            بعدد الألواح المقصوصة.
          </p>
          <table className="table mb-4">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>العدد</th>
                <th>تم القص؟</th>
                <th>عدد الألواح المقصوصة</th>
                <th>في فائض؟</th>
              </tr>
            </thead>
            <tbody>
              {approveSale.items.map((line) => {
                const choice = approveChoices[line.id]
                const isCut = choice?.cut || false
                const cutQtyNum = Number(choice?.cutQty || 0)
                const badQty = isCut && (!Number.isFinite(cutQtyNum) || cutQtyNum <= 0 || cutQtyNum > Number(line.qty))
                return (
                  <tr key={line.id}>
                    <td>
                      {line.surplusItem ? `فائض — ${line.itemCode} — ${line.itemName}` : `${line.itemCode} — ${line.itemName}`}
                    </td>
                    <td className="num">{qty(line.qty)}</td>
                    <td>
                      {line.surplusItem ? (
                        'لا'
                      ) : (
                        <input
                          type="checkbox"
                          checked={isCut}
                          onChange={(e) =>
                            setApproveChoices((current) => ({
                              ...current,
                              [line.id]: {
                                cut: e.target.checked,
                                cutQty: current[line.id]?.cutQty || String(line.qty),
                                surplus: e.target.checked ? current[line.id]?.surplus || false : false,
                              },
                            }))
                          }
                        />
                      )}
                    </td>
                    <td>
                      {line.surplusItem || !isCut ? (
                        '—'
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            className={`input num w-28 ${badQty ? 'border-[var(--color-accent-700)]' : ''}`}
                            type="number"
                            min="1"
                            max={line.qty}
                            step="any"
                            value={choice?.cutQty ?? String(line.qty)}
                            onChange={(e) =>
                              setApproveChoices((current) => ({
                                ...current,
                                [line.id]: {
                                  cut: current[line.id]?.cut || false,
                                  cutQty: e.target.value,
                                  surplus: current[line.id]?.surplus || false,
                                },
                              }))
                            }
                          />
                          <span className="text-xs text-[var(--color-muted)] num">/ {qty(line.qty)}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {line.surplusItem ? (
                        '—'
                      ) : (
                        <input
                          type="checkbox"
                          disabled={!isCut}
                          checked={choice?.surplus || false}
                          onChange={(e) =>
                            setApproveChoices((current) => ({
                              ...current,
                              [line.id]: {
                                cut: current[line.id]?.cut || false,
                                cutQty: current[line.id]?.cutQty || String(line.qty),
                                surplus: e.target.checked,
                              },
                            }))
                          }
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {invalidCutQty ? (
            <p className="m-0 mb-3 text-sm font-semibold text-[var(--color-accent-700)]">
              عدد الألواح المقصوصة لازم يكون أكبر من صفر ومش أكبر من كمية البند.
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitApprove}
              disabled={currentMonthClosed || invalidCutQty}
            >
              اعتماد وخصم من المخزون
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setApproveSale(null)}>
              رجوع
            </button>
          </div>
        </Dialog>
      ) : null}

      {returnSale ? (
        <Dialog title={`مرتجع ${returnSale.no}`} onClose={() => setReturnSale(null)}>
          <p className="m-0 mb-4">الألواح المقصوصة مقفولة. اختار كمية الرجوع من المتبقي غير المقصوص.</p>
          <table className="table mb-4">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>المتبقي للرجوع</th>
                <th>كمية المرتجع</th>
              </tr>
            </thead>
            <tbody>
              {returnSale.items.map((line) => {
                const cutQtyVal = Number(line.cutQty || 0)
                const cutBadge =
                  line.cut && cutQtyVal >= Number(line.qty)
                    ? ' — اتقص بالكامل'
                    : line.cut && cutQtyVal > 0
                      ? ` — اتقص ${qty(cutQtyVal)} من ${qty(line.qty)}`
                      : ''
                return (
                  <tr key={line.id}>
                    <td>
                      {line.itemCode} — {line.itemName}
                      {cutBadge}
                    </td>
                    <td className="num">{qty(line.returnableQty)}</td>
                    <td>
                      <input
                        className="input num"
                        disabled={line.returnableQty <= 0}
                        value={returnQtys[line.id] || '0'}
                        onChange={(e) => setReturnQtys((current) => ({ ...current, [line.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Field label="المستلم يُرد الآن">
            <input className="input num" value={receivedNow} onChange={(e) => setReceivedNow(e.target.value)} />
          </Field>
          <div className="flex gap-2 mt-4">
            <button type="button" className="btn btn-primary" onClick={submitReturn}>
              تسجيل المرتجع
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setReturnSale(null)}>
              رجوع
            </button>
          </div>
        </Dialog>
      ) : null}

      {effect ? (
        <Dialog title="أثر الحركة" onClose={() => setEffect(null)}>
          <p>{effect.message}</p>
          {effect.numbers.profit != null ? (
            <p>
              ربح الفاتورة <span className="num font-bold">{money(effect.numbers.profit || 0)}</span>
            </p>
          ) : null}
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
