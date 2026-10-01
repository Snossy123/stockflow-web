import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { ItemFormDialog, specText } from '../components/ItemFormDialog'
import { DataTable, Dialog, Field, Money, PageBody, PageError, PageHeader, Tabs } from '../components/ui'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, localIsoDate, money, qty, statusLabel } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { ApproveEffect, Expense, ExpenseType, Item, Purchase, Supplier } from '../lib/types'

type DraftLine = { itemId: number; qty: string; unitCost: string }

export function ExpensesPage() {
  const { can } = useAuth()
  const { isClosed, currentMonthClosed } = usePeriods()
  const [tab, setTab] = useState(can('expenses', 'view') ? 'general' : 'purchase')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [types, setTypes] = useState<ExpenseType[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [effect, setEffect] = useState<ApproveEffect | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [addItemForLine, setAddItemForLine] = useState<number | null>(null)
  const canAddItem = can('settings', 'create') || can('purchases', 'create') || can('sales', 'create')

  const [typeId, setTypeId] = useState<number>(0)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [wasteItem, setWasteItem] = useState(0)
  const [wasteQty, setWasteQty] = useState('')

  const [supplierId, setSupplierId] = useState(0)
  const [docDate, setDocDate] = useState(localIsoDate())
  const [paidNow, setPaidNow] = useState('0')
  const [lines, setLines] = useState<DraftLine[]>([{ itemId: 0, qty: '', unitCost: '' }])

  const selectedType = types.find((t) => t.id === typeId)
  const purchaseTotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitCost || 0), 0),
    [lines],
  )
  const expensesTable = useTableQuery(expenses, (row) =>
    searchText(
      row.typeName,
      row.amount,
      dateText(row.occurredAt),
      statusLabel(row.status),
      row.note,
      row.itemName,
      row.qty,
    ),
  )
  const purchasesTable = useTableQuery(purchases, (row) =>
    searchText(row.no, row.supplierName, dateText(row.docDate), dateText(row.postingDate), statusLabel(row.status), row.total),
  )

  function reload() {
    if (can('expenses', 'view')) {
      void apiGet<Expense[]>('/expenses').then(setExpenses)
      void apiGet<ExpenseType[]>('/expense-types').then((rows) => {
        setTypes(rows)
        const usable = rows.filter((type) => type.name !== 'عجز جرد')
        if (!typeId && usable[0]) setTypeId(usable[0].id)
      })
    }
    void apiGet<Item[]>('/items').then((rows) => {
      setItems(rows)
      if (!wasteItem && rows[0]) setWasteItem(rows[0].id)
      setLines((current) => current.map((line) => (line.itemId ? line : { ...line, itemId: rows[0]?.id || 0 })))
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

  const tabs = [
    ...(can('expenses', 'view') ? [{ id: 'general', label: 'واردات عمومية' }] : []),
    ...(can('purchases', 'view') ? [{ id: 'purchase', label: 'فاتورة شراء' }] : []),
  ]

  function resetPurchase() {
    setLines([{ itemId: items[0]?.id || 0, qty: '', unitCost: '' }])
    setPaidNow('0')
    setDocDate(localIsoDate())
  }

  return (
    <main>
      <PageHeader title="الواردات">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </PageHeader>
      <PageError>{error}</PageError>
      <PageBody>
        {tab === 'general' && can('expenses', 'view') ? (
          <DataTable
            query={expensesTable.query}
            onQueryChange={expensesTable.setQuery}
            page={expensesTable.page}
            pageCount={expensesTable.pageCount}
            filteredCount={expensesTable.filteredCount}
            totalCount={expensesTable.totalCount}
            onPageChange={expensesTable.setPage}
            emptyTitle="مفيش واردات"
            emptyHint="سجّل إيجار أو كهربا أو هالك من وارد جديد."
            toolbar={
              can('expenses', 'create') ? (
                <button type="button" className="btn btn-primary" onClick={() => setExpenseOpen(true)}>
                  وارد جديد
                </button>
              ) : null
            }
          >
            <table className="table">
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>القيمة</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th>ملاحظة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expensesTable.pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.typeName}</td>
                    <td>
                      <Money value={row.amount} />
                    </td>
                    <td className="num">{dateText(row.occurredAt)}</td>
                    <td>
                      <span className={row.status === 'approved' ? 'tag tag-ok' : 'tag'}>{statusLabel(row.status)}</span>
                    </td>
                    <td>{row.note || (row.itemName ? `${row.itemName} × ${qty(row.qty)}` : '—')}</td>
                    <td>
                      {row.status === 'approved' && !row.stockCountId && can('expenses', 'create') ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={currentMonthClosed}
                          onClick={() =>
                            apiPost<ApproveEffect>(`/expenses/${row.id}/reverse`)
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : null}

        {tab === 'purchase' && can('purchases', 'view') ? (
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
                    <td className="num">{row.no}</td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : null}
      </PageBody>

      {expenseOpen ? (
        <Dialog title="وارد جديد" onClose={() => setExpenseOpen(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setError(null)
              void apiPost<Expense>('/expenses', {
                typeId,
                amount: selectedType?.affectsStock ? undefined : Number(amount),
                note,
                itemId: selectedType?.affectsStock ? wasteItem : undefined,
                qty: selectedType?.affectsStock ? Number(wasteQty) : undefined,
              })
                .then(() => {
                  setAmount('')
                  setNote('')
                  setWasteQty('')
                  setExpenseOpen(false)
                  reload()
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الحفظ'))
            }}
          >
            <Field label="النوع">
              <select className="input" value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
                {types
                  .filter((type) => type.name !== 'عجز جرد')
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
              </select>
            </Field>
            {selectedType?.affectsStock ? (
              <>
                <Field label="الصنف">
                  <select className="input" value={wasteItem} onChange={(e) => setWasteItem(Number(e.target.value))}>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} — {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="الكمية">
                  <input className="input num" value={wasteQty} onChange={(e) => setWasteQty(e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="القيمة">
                <input className="input num" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            )}
            <Field label="ملاحظات">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-primary mt-2" disabled={currentMonthClosed}>
              تسجيل الوارد
            </button>
            {currentMonthClosed ? (
              <p className="m-0 text-sm text-[var(--color-accent-700)]">الفترة الحالية مقفولة. الوارد واقف لحد ما تتفتح.</p>
            ) : null}
          </form>
        </Dialog>
      ) : null}

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
                          {items.map((row) => (
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
              onClick={() => setLines((rows) => [...rows, { itemId: items[0]?.id || 0, qty: '', unitCost: '' }])}
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
    </main>
  )
}
