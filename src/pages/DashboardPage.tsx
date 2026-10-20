import { Receipt, TrendingUp, Truck, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { InvoiceDetailsDialog, InvoiceRefButton, type InvoiceViewTarget } from '../components/InvoiceDetailsDialog'
import { DataTable, EmptyState, KpiCard, Money, PageBody, PageError, PageHeader, SectionTitle } from '../components/ui'
import { apiGet } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, kindLabel, refTypeLabel } from '../lib/format'
import { searchText, useTableQuery } from '../lib/table'
import type { Dashboard } from '../lib/types'

function kpiIcon(label: string) {
  if (label.includes('صادر')) return <Receipt size={18} strokeWidth={1.75} />
  if (label.includes('تكلفة')) return <Wallet size={18} strokeWidth={1.75} />
  if (label.includes('مديون')) return <Truck size={18} strokeWidth={1.75} />
  return <TrendingUp size={18} strokeWidth={1.75} />
}

export function DashboardPage() {
  const { can } = useAuth()
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailTarget, setDetailTarget] = useState<InvoiceViewTarget | null>(null)
  const recent = useTableQuery(data?.recent || [], (row) =>
    searchText(kindLabel(row.kind), row.itemName, dateText(row.occurredAt), row.qtyIn, row.qtyOut, row.refNo, row.refId),
  )

  useEffect(() => {
    apiGet<Dashboard>('/dashboard')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'تعذر التحميل'))
  }, [])

  return (
    <main>
      <PageHeader
        kicker={new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
        title="لوحة رئيسية"
        actions={
          <>
            {can('purchases', 'create') ? (
              <Link to="/purchases" className="btn btn-secondary">
                فاتورة شراء
              </Link>
            ) : null}
            {can('sales', 'create') ? (
              <Link to="/revenue" className="btn btn-primary">
                فاتورة بيع جديدة
              </Link>
            ) : null}
          </>
        }
      />
      <PageError>{error}</PageError>
      <PageBody>
        <div className="kpi-grid mb-5">
          {(data?.kpis || []).map((kpi) => (
            <KpiCard
              key={kpi.label}
              icon={kpiIcon(kpi.label)}
              label={kpi.label}
              value={<Money value={kpi.value} />}
              hint={kpi.hint}
            />
          ))}
        </div>
        {data?.purchaseNote ? <p className="m-0 mb-6 text-sm text-[var(--color-muted)]">{data.purchaseNote}</p> : null}
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section>
            <SectionTitle kicker="المخزن">آخر الحركات</SectionTitle>
            {!data?.recent.length ? (
              <EmptyState title="مفيش حركات" hint="الحركات هتظهر بعد اعتماد فواتير الشراء والبيع." />
            ) : (
              <DataTable
                query={recent.query}
                onQueryChange={recent.setQuery}
                page={recent.page}
                pageCount={recent.pageCount}
                filteredCount={recent.filteredCount}
                totalCount={recent.totalCount}
                onPageChange={recent.setPage}
                emptyTitle="مفيش حركات مطابقة"
                emptyHint="الحركات هتظهر بعد اعتماد فواتير الشراء والبيع."
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>النوع</th>
                      <th>الصنف</th>
                      <th>التاريخ</th>
                      <th>الكمية</th>
                      <th>المرجع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.pageRows.map((row) => (
                      <tr key={row.id}>
                        <td>{kindLabel(row.kind)}</td>
                        <td>{row.itemName}</td>
                        <td className="num">{dateText(row.occurredAt)}</td>
                        <td className="num">{row.qtyIn > 0 ? `+${row.qtyIn}` : `-${row.qtyOut}`}</td>
                        <td>
                          {row.refType === 'sale' || row.refType === 'purchase' ? (
                            <InvoiceRefButton
                              label={row.refNo || `#${row.refId}`}
                              title={`عرض ${refTypeLabel(row.refType)}`}
                              onClick={() => setDetailTarget({ kind: row.refType as 'sale' | 'purchase', id: row.refId })}
                            />
                          ) : (
                            <span className="text-xs text-[var(--color-muted)]">
                              {refTypeLabel(row.refType)} <span className="num">{row.refNo || `#${row.refId}`}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            )}
          </section>
          <section>
            <SectionTitle kicker="متابعة">تنبيهات</SectionTitle>
            {!data?.alerts.length ? (
              <EmptyState title="مفيش تنبيهات" hint="المخزون والمديونية في الحدود." />
            ) : (
              <div className="flex flex-col gap-3">
                {data.alerts.map((alert) => (
                  <div
                    key={alert.message}
                    className={alert.kind === 'low-stock' ? 'alert-card alert-card-warn' : 'alert-card'}
                  >
                    <div className="card-kicker">{alert.kind === 'low-stock' ? 'مخزون منخفض' : 'مديونية مورد'}</div>
                    <p className="m-0 text-sm">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </PageBody>

      <InvoiceDetailsDialog
        target={detailTarget}
        onClose={() => setDetailTarget(null)}
        onSelectTarget={setDetailTarget}
      />
    </main>
  )
}
