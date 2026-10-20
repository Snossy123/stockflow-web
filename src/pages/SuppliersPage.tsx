import { useEffect, useMemo, useState } from 'react'
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
  Tabs,
} from '../components/ui'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, dateTimeText, money } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { Payment, Purchase, Supplier } from '../lib/types'

export function SuppliersPage() {
  const { can } = useAuth()
  const { currentMonthClosed } = usePeriods()
  const [searchParams] = useSearchParams()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [supplierQuery, setSupplierQuery] = useState('')
  const [detailTab, setDetailTab] = useState('purchases')
  const [detailTarget, setDetailTarget] = useState<InvoiceViewTarget | null>(null)
  const purchasesTable = useTableQuery(purchases, (row) =>
    searchText(row.no, dateText(row.docDate), dateText(row.postingDate), row.total),
  )
  const paymentsTable = useTableQuery(payments, (row) => searchText(dateTimeText(row.occurredAt), row.amount, row.ref))
  const visibleSuppliers = useMemo(() => {
    const needle = supplierQuery.trim().toLowerCase()
    if (!needle) return suppliers
    return suppliers.filter((supplier) =>
      searchText(
        supplier.name,
        supplier.phone,
        supplier.debt,
        supplier.paid,
        supplier.itemNames.join(' '),
        supplier.debt > 0 ? 'عليه' : 'متسوي',
      )
        .toLowerCase()
        .includes(needle),
    )
  }, [suppliers, supplierQuery])

  function reload() {
    void apiGet<Supplier[]>('/suppliers').then((rows) => {
      setSuppliers(rows)
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
    if (paramId && suppliers.length) {
      const target = suppliers.find((row) => row.id === paramId)
      if (target) setSelected(target)
    }
    const tabParam = searchParams.get('tab')
    if (tabParam === 'payments' || tabParam === 'purchases') {
      setDetailTab(tabParam)
    }
    const q = searchParams.get('q')
    if (q) {
      paymentsTable.setQuery(q)
    }
  }, [searchParams, suppliers])

  useEffect(() => {
    if (!selected) return
    void apiGet<Purchase[]>(`/suppliers/${selected.id}/purchases`).then(setPurchases)
    void apiGet<Payment[]>(`/suppliers/${selected.id}/payments`).then(setPayments)
  }, [selected?.id])

  return (
    <main>
      <PageHeader
        title="الموردين"
        actions={
          can('suppliers', 'create') ? (
            <button type="button" className="btn btn-primary" onClick={() => setSupplierOpen(true)}>
              مورد جديد
            </button>
          ) : null
        }
      />
      <PageError>{error}</PageError>
      <PageBody>
        {!suppliers.length ? (
          <EmptyState title="مفيش موردين" hint="أضف مورد من الدليل وبعدين سجّل فواتير الشراء." />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <div>
              <ListSearch query={supplierQuery} onQueryChange={setSupplierQuery} />
              {!visibleSuppliers.length ? (
                <EmptyState
                  title="مفيش نتائج"
                  hint="جرّب تشيل البحث أو غيّر الكلمة."
                  onClear={() => setSupplierQuery('')}
                />
              ) : (
                <div className="entity-list">
                  {visibleSuppliers.map((supplier) => (
                    <EntityTile
                      key={supplier.id}
                      current={selected?.id === supplier.id}
                      onClick={() => setSelected(supplier)}
                    >
                      <div className="flex justify-between">
                        <div className="font-bold text-lg">{supplier.name}</div>
                        <span className={supplier.debt > 0 ? 'tag tag-accent' : 'tag tag-ok'}>
                          {supplier.debt > 0 ? 'عليه' : 'متسوي'}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-muted)] mt-1">
                        {supplier.itemNames.length ? supplier.itemNames.join(' · ') : 'لسه مفيش أصناف'}
                      </div>
                      <div className="flex gap-6 mt-3">
                        <div>
                          <div className="text-[11px] text-[var(--color-muted)]">المديونية</div>
                          <div className="font-bold">
                            <Money value={supplier.debt} />
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[var(--color-muted)]">إجمالي المدفوع</div>
                          <div className="font-bold">
                            <Money value={supplier.paid} />
                          </div>
                        </div>
                      </div>
                    </EntityTile>
                  ))}
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
                        { id: 'purchases', label: 'فواتير الشراء' },
                        { id: 'payments', label: 'سجل الدفعات' },
                      ]}
                      value={detailTab}
                      onChange={setDetailTab}
                    />
                  </div>
                  <div className="panel-body">
                    {detailTab === 'purchases' ? (
                      <DataTable
                        query={purchasesTable.query}
                        onQueryChange={purchasesTable.setQuery}
                        page={purchasesTable.page}
                        pageCount={purchasesTable.pageCount}
                        filteredCount={purchasesTable.filteredCount}
                        totalCount={purchasesTable.totalCount}
                        onPageChange={purchasesTable.setPage}
                        emptyTitle="مفيش فواتير"
                        emptyHint="فواتير الشراء المرتبطة بالمورد هتظهر هنا."
                      >
                        <table className="table">
                          <thead>
                            <tr>
                              <th>رقم</th>
                              <th>تاريخ المستند</th>
                              <th>تاريخ الترحيل</th>
                              <th>القيمة</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchasesTable.pageRows.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <InvoiceRefButton
                                      label={row.no}
                                      onClick={() => setDetailTarget({ kind: 'purchase', data: row })}
                                    />
                                    {row.reversedOfId && row.reversedOfNo ? (
                                      <InvoiceRefButton
                                        label={row.reversedOfNo}
                                        title="عرض فاتورة الشراء الأصلية"
                                        onClick={() => setDetailTarget({ kind: 'purchase', id: row.reversedOfId! })}
                                      />
                                    ) : null}
                                  </div>
                                </td>
                                <td className="num">{dateText(row.docDate)}</td>
                                <td className="num">{dateText(row.postingDate)}</td>
                                <td className="num">{money(row.total)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setDetailTarget({ kind: 'purchase', data: row })}
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
                        query={paymentsTable.query}
                        onQueryChange={paymentsTable.setQuery}
                        page={paymentsTable.page}
                        pageCount={paymentsTable.pageCount}
                        filteredCount={paymentsTable.filteredCount}
                        totalCount={paymentsTable.totalCount}
                        onPageChange={paymentsTable.setPage}
                        emptyTitle="مفيش دفعات"
                        emptyHint="سجّل دفعة عشان تقلل المديونية."
                        toolbar={
                          can('suppliers', 'create') ? (
                            <button type="button" className="btn btn-primary" onClick={() => setPaymentOpen(true)}>
                              تسجيل دفعة
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
                            {paymentsTable.pageRows.map((row) => {
                              const rawRef = (row.ref || '').trim()
                              const candidateNo = rawRef.startsWith('عكس ')
                                ? rawRef.slice('عكس '.length).trim()
                                : rawRef
                              const matchedPurchase = candidateNo
                                ? purchases.find((p) => p.no.toLowerCase() === candidateNo.toLowerCase())
                                : undefined
                              return (
                                <tr key={row.id}>
                                  <td className="num">{dateTimeText(row.occurredAt)}</td>
                                  <td className="num">{money(row.amount)}</td>
                                  <td>
                                    {matchedPurchase ? (
                                      <InvoiceRefButton
                                        label={rawRef}
                                        onClick={() => setDetailTarget({ kind: 'purchase', data: matchedPurchase })}
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

      {supplierOpen ? (
        <Dialog title="مورد جديد" onClose={() => setSupplierOpen(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void apiPost<Supplier>('/suppliers', { name, phone })
                .then(() => {
                  setName('')
                  setPhone('')
                  setSupplierOpen(false)
                  reload()
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الحفظ'))
            }}
          >
            <Field label="اسم المورد">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="الهاتف">
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-primary mt-2">
              إضافة
            </button>
          </form>
        </Dialog>
      ) : null}

      {paymentOpen && selected ? (
        <Dialog title={`دفعة لـ ${selected.name}`} onClose={() => setPaymentOpen(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void apiPost(`/suppliers/${selected.id}/payments`, { amount: Number(amount), method: 'cash' })
                .then(() => {
                  setAmount('')
                  setPaymentOpen(false)
                  reload()
                  void apiGet<Payment[]>(`/suppliers/${selected.id}/payments`).then(setPayments)
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الدفعة'))
            }}
          >
            <Field label="المبلغ">
              <input className="input num" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-primary mt-2" disabled={currentMonthClosed}>
              تسجيل دفعة
            </button>
            {currentMonthClosed ? (
              <p className="m-0 text-sm text-[var(--color-accent-700)]">الفترة الحالية مقفولة. الدفع واقف لحد ما تتفتح.</p>
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
