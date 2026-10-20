import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTable, Dialog, Field, Money, PageBody, PageError, PageHeader } from '../components/ui'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, money, qty, statusLabel } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { ApproveEffect, Expense, ExpenseType, Item } from '../lib/types'

export function ExpensesPage() {
  const { can } = useAuth()
  const { currentMonthClosed } = usePeriods()
  const [searchParams, setSearchParams] = useSearchParams()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [types, setTypes] = useState<ExpenseType[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [effect, setEffect] = useState<ApproveEffect | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expenseOpen, setExpenseOpen] = useState(false)

  const [typeId, setTypeId] = useState<number>(0)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [wasteItem, setWasteItem] = useState(0)
  const [wasteQty, setWasteQty] = useState('')

  const selectedType = types.find((t) => t.id === typeId)
  const expensesTable = useTableQuery(expenses, (row) =>
    searchText(
      row.id,
      row.typeName,
      row.amount,
      dateText(row.occurredAt),
      statusLabel(row.status),
      row.note,
      row.itemName,
      row.qty,
    ),
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
    })
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      expensesTable.setQuery(q)
    }
  }, [searchParams])

  useEffect(() => {
    const refId = Number(searchParams.get('refId'))
    if (!refId || expenses.length === 0) return
    const target = expenses.find((row) => row.id === refId)
    if (target) {
      expensesTable.setQuery(target.itemName || target.typeName)
      setSelectedExpense(target)
    }
  }, [searchParams, expenses])

  function clearRefParam() {
    if (!searchParams.has('refId')) return
    const next = new URLSearchParams(searchParams)
    next.delete('refId')
    setSearchParams(next, { replace: true })
  }

  return (
    <main>
      <PageHeader title="المصروفات العمومية" />
      <PageError>{error}</PageError>
      <PageBody>
        {can('expenses', 'view') ? (
          <DataTable
            query={expensesTable.query}
            onQueryChange={expensesTable.setQuery}
            page={expensesTable.page}
            pageCount={expensesTable.pageCount}
            filteredCount={expensesTable.filteredCount}
            totalCount={expensesTable.totalCount}
            onPageChange={expensesTable.setPage}
            emptyTitle="مفيش مصروفات عمومية"
            emptyHint="سجّل إيجار أو كهربا أو هالك من مصروف جديد."
            toolbar={
              can('expenses', 'create') ? (
                <button type="button" className="btn btn-primary" onClick={() => setExpenseOpen(true)}>
                  مصروف جديد
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
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setSelectedExpense(row)}
                      >
                        {row.typeName} <span className="num">#{row.id}</span>
                      </button>
                    </td>
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
      </PageBody>

      {expenseOpen ? (
        <Dialog title="مصروف جديد" onClose={() => setExpenseOpen(false)}>
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
              تسجيل المصروف
            </button>
            {currentMonthClosed ? (
              <p className="m-0 text-sm text-[var(--color-accent-700)]">الفترة الحالية مقفولة. المصروف واقف لحد ما تتفتح.</p>
            ) : null}
          </form>
        </Dialog>
      ) : null}

      {selectedExpense ? (
        <Dialog
          title={`تفاصيل مصروف #${selectedExpense.id}`}
          onClose={() => {
            setSelectedExpense(null)
            clearRefParam()
          }}
        >
          <dl className="card grid gap-3 m-0 mb-4">
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">رقم المصروف</dt>
              <dd className="m-0 num font-bold">#{selectedExpense.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">النوع</dt>
              <dd className="m-0 font-bold">{selectedExpense.typeName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">القيمة</dt>
              <dd className="m-0 num font-bold">{money(selectedExpense.amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">التاريخ</dt>
              <dd className="m-0 num">{dateText(selectedExpense.occurredAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">الحالة</dt>
              <dd className="m-0">
                <span className={selectedExpense.status === 'approved' ? 'tag tag-ok' : 'tag'}>
                  {statusLabel(selectedExpense.status)}
                </span>
              </dd>
            </div>
            {selectedExpense.itemName ? (
              <div className="flex justify-between">
                <dt className="text-xs text-[var(--color-muted)]">الصنف والكمية</dt>
                <dd className="m-0 font-bold">
                  {selectedExpense.itemName} × <span className="num">{qty(selectedExpense.qty)}</span>
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">ملاحظة</dt>
              <dd className="m-0">{selectedExpense.note || '—'}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelectedExpense(null)
              clearRefParam()
            }}
          >
            إغلاق
          </button>
        </Dialog>
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
