import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { InvoiceDetailsDialog, InvoiceRefButton, type InvoiceViewTarget } from '../components/InvoiceDetailsDialog'
import {
  DataTable,
  Dialog,
  EmptyState,
  EntityTile,
  Field,
  ListSearch,
  Money,
  PageBody,
  PageError,
  PageHeader,
  Panel,
  TablePager,
  Tabs,
} from '../components/ui'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateTimeText, money, statusLabel } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { Customer, Payment, Sale } from '../lib/types'

export function CustomersPage() {
  const { can } = useAuth()
  const { currentMonthClosed } = usePeriods()
  const [searchParams] = useSearchParams()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selected, setSelected] = useState<Customer | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [receipts, setReceipts] = useState<Payment[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [detailTab, setDetailTab] = useState('sales')
  const [detailTarget, setDetailTarget] = useState<InvoiceViewTarget | null>(null)
  const customersTable = useTableQuery(customers, (row) =>
    searchText(row.name, row.phone, row.owed, row.paid, row.remaining, row.remaining > 0 ? 'عليه' : 'متسوي'),
  )
  const salesTable = useTableQuery(sales, (row) =>
    searchText(row.no, row.kind === 'return' ? 'مرتجع' : 'بيع', row.total, statusLabel(row.status)),
  )
  const receiptsTable = useTableQuery(receipts, (row) => searchText(dateTimeText(row.occurredAt), row.amount, row.ref))

  function reload() {
    void apiGet<Customer[]>('/customers').then((rows) => {
      setCustomers(rows)
      const paramId = Number(searchParams.get('id'))
      setSelected((current) =>
        (paramId ? rows.find((row) => row.id === paramId) : undefined) ||
        rows.find((row) => row.id === current?.id) ||
        rows[0] ||
        null,
      )
    })
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const paramId = Number(searchParams.get('id'))
    if (paramId && customers.length) {
      const target = customers.find((row) => row.id === paramId)
      if (target) setSelected(target)
    }
    const tabParam = searchParams.get('tab')
    if (tabParam === 'receipts' || tabParam === 'sales') {
      setDetailTab(tabParam)
    }
    const q = searchParams.get('q')
    if (q) {
      receiptsTable.setQuery(q)
    }
  }, [searchParams, customers])

  useEffect(() => {
    if (!selected) return
    void apiGet<Sale[]>(`/customers/${selected.id}/sales`).then(setSales)
    void apiGet<Payment[]>(`/customers/${selected.id}/receipts`).then(setReceipts)
  }, [selected?.id])

  return (
    <main>
      <PageHeader
        title="العملاء"
        actions={
          can('customers', 'create') ? (
            <button type="button" className="btn btn-primary" onClick={() => setCustomerOpen(true)}>
              عميل جديد
            </button>
          ) : null
        }
      />
      <PageError>{error}</PageError>
      <PageBody>
        {!customers.length ? (
          <EmptyState title="مفيش عملاء" hint="أضف عميل وبعدين سجّل فاتورة بيع." />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <div>
              <ListSearch query={customersTable.query} onQueryChange={customersTable.setQuery} />
              {!customersTable.filteredCount ? (
                <EmptyState
                  title="مفيش نتائج"
                  hint="جرّب تشيل البحث أو غيّر الكلمة."
                  onClear={() => customersTable.setQuery('')}
                />
              ) : (
                <div className="entity-list">
                  {customersTable.pageRows.map((customer) => (
                    <EntityTile
                      key={customer.id}
                      current={selected?.id === customer.id}
                      onClick={() => setSelected(customer)}
                    >
                      <div className="flex justify-between">
                        <div className="font-bold text-lg">{customer.name}</div>
                        <span className={customer.remaining > 0 ? 'tag tag-accent' : 'tag tag-ok'}>
                          {customer.remaining > 0 ? 'عليه' : 'متسوي'}
                        </span>
                      </div>
                      <div className="flex gap-6 mt-3">
                        <div>
                          <div className="text-[11px] text-[var(--color-muted)]">عليه</div>
                          <div className="font-bold">
                            <Money value={customer.owed} />
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[var(--color-muted)]">مستلم</div>
                          <div className="font-bold">
                            <Money value={customer.paid} />
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[var(--color-muted)]">المتبقي</div>
                          <div className="font-bold text-[var(--color-accent-700)]">
                            <Money value={customer.remaining} />
                          </div>
                        </div>
                      </div>
                    </EntityTile>
                  ))}
                  <TablePager
                    page={customersTable.page}
                    pageCount={customersTable.pageCount}
                    filteredCount={customersTable.filteredCount}
                    totalCount={customersTable.totalCount}
                    onPageChange={customersTable.setPage}
                  />
                </div>
              )}
            </div>
            <div>
              {selected ? (
                <Panel title={selected.name}>
                  <div className="panel-tabs">
                    <Tabs
                      className="mt-0"
                      tabs={[
                        { id: 'sales', label: 'فواتير البيع' },
                        { id: 'receipts', label: 'سجل الاستلام' },
                      ]}
                      value={detailTab}
                      onChange={setDetailTab}
                    />
                  </div>
                  <div className="panel-body">
                    {detailTab === 'sales' ? (
                      <DataTable
                        query={salesTable.query}
                        onQueryChange={salesTable.setQuery}
                        page={salesTable.page}
                        pageCount={salesTable.pageCount}
                        filteredCount={salesTable.filteredCount}
                        totalCount={salesTable.totalCount}
                        onPageChange={salesTable.setPage}
                        emptyTitle="مفيش فواتير"
                        emptyHint="فواتير العميل هتظهر هنا بعد الاعتماد."
                      >
                        <table className="table">
                          <thead>
                            <tr>
                              <th>رقم</th>
                              <th>النوع</th>
                              <th>القيمة</th>
                              <th>الحالة</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {salesTable.pageRows.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <InvoiceRefButton
                                    label={row.no}
                                    onClick={() => setDetailTarget({ kind: 'sale', data: row })}
                                  />
                                </td>
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
                                <td>{statusLabel(row.status)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setDetailTarget({ kind: 'sale', data: row })}
                                  >
                                    التفاصيل
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </DataTable>
                    ) : (
                      <DataTable
                        query={receiptsTable.query}
                        onQueryChange={receiptsTable.setQuery}
                        page={receiptsTable.page}
                        pageCount={receiptsTable.pageCount}
                        filteredCount={receiptsTable.filteredCount}
                        totalCount={receiptsTable.totalCount}
                        onPageChange={receiptsTable.setPage}
                        emptyTitle="مفيش استلام"
                        emptyHint="سجّل استلام عشان تقلل اللي على العميل."
                        toolbar={
                          can('customers', 'create') ? (
                            <button type="button" className="btn btn-primary" onClick={() => setReceiptOpen(true)}>
                              استلام
                            </button>
                          ) : null
                        }
                      >
                        <table className="table">
                          <thead>
                            <tr>
                              <th>التاريخ والوقت</th>
                              <th>المبلغ</th>
                              <th>مرجع</th>
                            </tr>
                          </thead>
                          <tbody>
                            {receiptsTable.pageRows.map((row) => {
                              const rawRef = (row.ref || '').trim()
                              const candidateNo = rawRef.startsWith('مرتجع ')
                                ? rawRef.slice('مرتجع '.length).trim()
                                : rawRef
                              const matchedSale = candidateNo
                                ? sales.find((s) => s.no.toLowerCase() === candidateNo.toLowerCase())
                                : undefined
                              return (
                                <tr key={row.id}>
                                  <td className="num">{dateTimeText(row.occurredAt)}</td>
                                  <td className="num">{money(row.amount)}</td>
                                  <td>
                                    {matchedSale ? (
                                      <InvoiceRefButton
                                        label={rawRef}
                                        onClick={() => setDetailTarget({ kind: 'sale', data: matchedSale })}
                                      />
                                    ) : (
                                      row.ref || '—'
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </DataTable>
                    )}
                  </div>
                </Panel>
              ) : null}
            </div>
          </div>
        )}
      </PageBody>

      {customerOpen ? (
        <Dialog title="عميل جديد" onClose={() => setCustomerOpen(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void apiPost<Customer>('/customers', { name })
                .then(() => {
                  setName('')
                  setCustomerOpen(false)
                  reload()
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الحفظ'))
            }}
          >
            <Field label="اسم العميل">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <button type="submit" className="btn btn-primary mt-2">
              إضافة
            </button>
          </form>
        </Dialog>
      ) : null}

      {receiptOpen && selected ? (
        <Dialog title={`استلام من ${selected.name}`} onClose={() => setReceiptOpen(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void apiPost(`/customers/${selected.id}/receipts`, { amount: Number(amount), method: 'cash' })
                .then(() => {
                  setAmount('')
                  setReceiptOpen(false)
                  reload()
                  void apiGet<Payment[]>(`/customers/${selected.id}/receipts`).then(setReceipts)
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الاستلام'))
            }}
          >
            <Field label="المبلغ">
              <input className="input num" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-primary mt-2" disabled={currentMonthClosed}>
              تسجيل استلام
            </button>
            {currentMonthClosed ? (
              <p className="m-0 text-sm text-[var(--color-accent-700)]">الفترة الحالية مقفولة. الاستلام واقف لحد ما تتفتح.</p>
            ) : null}
          </form>
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
