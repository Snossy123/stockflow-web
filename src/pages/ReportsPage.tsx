import { useEffect, useState } from 'react'
import { DataTable, EmptyState, KpiCard, Money, PageBody, PageError, PageHeader, SectionTitle, Tabs } from '../components/ui'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, localIsoDate, money } from '../lib/format'
import { searchText, useTableQuery } from '../lib/table'
import type { AgingReport, CashReport, ItemProfitRow, PnlRow, ReorderRow } from '../lib/types'

export function ReportsPage() {
  const { can } = useAuth()
  const [tab, setTab] = useState('pnl')
  const [pnl, setPnl] = useState<PnlRow[]>([])
  const [cash, setCash] = useState<CashReport | null>(null)
  const [aging, setAging] = useState<AgingReport | null>(null)
  const [profit, setProfit] = useState<ItemProfitRow[]>([])
  const [reorder, setReorder] = useState<ReorderRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const pnlTable = useTableQuery(pnl, (row) => searchText(row.period, row.closed ? 'مقفول' : ''))
  const cashTable = useTableQuery(cash?.rows || [], (row) => searchText(dateText(row.at), row.label, row.in, row.out, row.balance))
  const agingCustomers = useTableQuery(aging?.customers || [], (row) => searchText(row.partyName, row.d0, row.d31, row.d60))
  const agingSuppliers = useTableQuery(aging?.suppliers || [], (row) => searchText(row.partyName, row.d0, row.d31, row.d60))
  const profitTable = useTableQuery(profit, (row) => searchText(row.itemName, row.revenue, row.cost, row.profit, row.margin, row.weight))
  const reorderTable = useTableQuery(reorder, (row) =>
    searchText(row.itemName, row.onHand, row.minQty, row.shortage, row.weeklyUse, row.suggested, row.cheapestSupplier),
  )

  useEffect(() => {
    void apiGet<PnlRow[]>('/reports/pnl').then(setPnl).catch((err: unknown) => setError(err instanceof Error ? err.message : 'تعذر التحميل'))
    void apiGet<CashReport>('/reports/cash').then(setCash)
    void apiGet<AgingReport>('/reports/aging').then(setAging)
    void apiGet<ItemProfitRow[]>('/reports/item-profit').then(setProfit)
    void apiGet<ReorderRow[]>('/reports/reorder').then(setReorder)
  }, [])

  return (
    <main>
      <PageHeader title="التقارير">
        <Tabs
          tabs={[
            { id: 'pnl', label: 'الأرباح والخسائر' },
            { id: 'cash', label: 'حركة اليومية' },
            { id: 'aging', label: 'أعمار المديونية' },
            { id: 'profit', label: 'ربحية الصنف' },
            { id: 'reorder', label: 'تحت الحد' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </PageHeader>
      <PageError>{error}</PageError>
      <PageBody>
        {tab === 'pnl' ? (
          !pnl.length ? (
            <EmptyState title="مفيش بيانات" hint="التقرير هيتبني بعد اعتماد فواتير البيع والواردات." />
          ) : (
            <DataTable
              query={pnlTable.query}
              onQueryChange={pnlTable.setQuery}
              page={pnlTable.page}
              pageCount={pnlTable.pageCount}
              filteredCount={pnlTable.filteredCount}
              totalCount={pnlTable.totalCount}
              onPageChange={pnlTable.setPage}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>الشهر</th>
                    <th>صادرات</th>
                    <th>تكلفة مبيعات</th>
                    <th>ربح إجمالي</th>
                    <th>واردات</th>
                    <th>صافي</th>
                  </tr>
                </thead>
                <tbody>
                  {pnlTable.pageRows.map((row) => (
                    <tr key={row.period}>
                      <td>
                        <span className="num">{row.period}</span>
                        {row.closed ? <span className="tag tag-accent mr-2">مقفول</span> : null}
                      </td>
                      <td>
                        <Money value={row.revenue} />
                      </td>
                      <td>
                        <Money value={row.cogs} />
                      </td>
                      <td>
                        <Money value={row.gross} />
                      </td>
                      <td>
                        <Money value={row.expenses} />
                      </td>
                      <td className="font-bold">
                        <Money value={row.net} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )
        ) : null}

        {tab === 'cash' ? (
          <>
            <div className="kpi-grid mb-5">
              <KpiCard label="رصيد البداية" value={<span className="num">{money(cash?.opening || 0)}</span>} />
              <KpiCard label="رصيد النهاية" value={<span className="num">{money(cash?.closing || 0)}</span>} />
            </div>
            {!cash?.rows.length ? (
              <EmptyState title="مفيش حركة نقدية اليوم" hint="الاستلام ودفعات الموردين والواردات العمومية تظهر هنا. الآجل مستبعد." />
            ) : (
              <DataTable
                query={cashTable.query}
                onQueryChange={cashTable.setQuery}
                page={cashTable.page}
                pageCount={cashTable.pageCount}
                filteredCount={cashTable.filteredCount}
                totalCount={cashTable.totalCount}
                onPageChange={cashTable.setPage}
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>الوقت</th>
                      <th>البيان</th>
                      <th>داخل</th>
                      <th>خارج</th>
                      <th>الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashTable.pageRows.map((row, index) => (
                      <tr key={`${row.at}-${index}`}>
                        <td className="num">{dateText(row.at)}</td>
                        <td>{row.label}</td>
                        <td>
                          <Money value={row.in} />
                        </td>
                        <td>
                          <Money value={row.out} />
                        </td>
                        <td>
                          <Money value={row.balance} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            )}
          </>
        ) : null}

        {tab === 'aging' ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <section>
              <SectionTitle kicker="مديونية">عملاء</SectionTitle>
              {!aging?.customers.length ? (
                <EmptyState title="مفيش مديونية عملاء" hint="الفواتير الآجلة هتتقسم ٠–٣٠ / ٣١–٦٠ / ٦٠+." />
              ) : (
                <DataTable
                  query={agingCustomers.query}
                  onQueryChange={agingCustomers.setQuery}
                  page={agingCustomers.page}
                  pageCount={agingCustomers.pageCount}
                  filteredCount={agingCustomers.filteredCount}
                  totalCount={agingCustomers.totalCount}
                  onPageChange={agingCustomers.setPage}
                >
                  <table className="table">
                    <thead>
                      <tr>
                        <th>الاسم</th>
                        <th>٠–٣٠</th>
                        <th>٣١–٦٠</th>
                        <th>٦٠+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agingCustomers.pageRows.map((row) => (
                        <tr key={row.partyName}>
                          <td>{row.partyName}</td>
                          <td>
                            <Money value={row.d0} />
                          </td>
                          <td>
                            <Money value={row.d31} />
                          </td>
                          <td>
                            <Money value={row.d60} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
              )}
            </section>
            <section>
              <SectionTitle kicker="مديونية">موردين</SectionTitle>
              {!aging?.suppliers.length ? (
                <EmptyState title="مفيش مديونية موردين" hint="الباقي على فواتير الشراء يظهر هنا." />
              ) : (
                <DataTable
                  query={agingSuppliers.query}
                  onQueryChange={agingSuppliers.setQuery}
                  page={agingSuppliers.page}
                  pageCount={agingSuppliers.pageCount}
                  filteredCount={agingSuppliers.filteredCount}
                  totalCount={agingSuppliers.totalCount}
                  onPageChange={agingSuppliers.setPage}
                >
                  <table className="table">
                    <thead>
                      <tr>
                        <th>الاسم</th>
                        <th>٠–٣٠</th>
                        <th>٣١–٦٠</th>
                        <th>٦٠+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agingSuppliers.pageRows.map((row) => (
                        <tr key={row.partyName}>
                          <td>{row.partyName}</td>
                          <td>
                            <Money value={row.d0} />
                          </td>
                          <td>
                            <Money value={row.d31} />
                          </td>
                          <td>
                            <Money value={row.d60} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
              )}
            </section>
          </div>
        ) : null}

        {tab === 'profit' ? (
          !profit.length ? (
            <EmptyState title="مفيش ربحية أصناف" hint="بعد اعتماد فواتير البيع هيتحسب الصادر والتكلفة والهامش." />
          ) : (
            <DataTable
              query={profitTable.query}
              onQueryChange={profitTable.setQuery}
              page={profitTable.page}
              pageCount={profitTable.pageCount}
              filteredCount={profitTable.filteredCount}
              totalCount={profitTable.totalCount}
              onPageChange={profitTable.setPage}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>صادر</th>
                    <th>تكلفة</th>
                    <th>ربح</th>
                    <th>هامش %</th>
                    <th>الوزن %</th>
                  </tr>
                </thead>
                <tbody>
                  {profitTable.pageRows.map((row) => (
                    <tr key={row.itemId}>
                      <td>{row.itemName}</td>
                      <td>
                        <Money value={row.revenue} />
                      </td>
                      <td>
                        <Money value={row.cost} />
                      </td>
                      <td>
                        <Money value={row.profit} />
                      </td>
                      <td className="num">{row.margin}</td>
                      <td className="num">{row.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )
        ) : null}

        {tab === 'reorder' ? (
          !reorder.length ? (
            <EmptyState title="كل الأصناف فوق الحد" hint="الأصناف تحت حد التنبيه هتظهر هنا مع أرخص مورد." />
          ) : (
            <DataTable
              query={reorderTable.query}
              onQueryChange={reorderTable.setQuery}
              page={reorderTable.page}
              pageCount={reorderTable.pageCount}
              filteredCount={reorderTable.filteredCount}
              totalCount={reorderTable.totalCount}
              onPageChange={reorderTable.setPage}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>متاح</th>
                    <th>الحد</th>
                    <th>النقص</th>
                    <th>استهلاك أسبوعي</th>
                    <th>مقترح</th>
                    <th>أرخص مورد</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reorderTable.pageRows.map((row) => (
                    <tr key={row.itemId}>
                      <td>{row.itemName}</td>
                      <td className="num">{row.onHand}</td>
                      <td className="num">{row.minQty}</td>
                      <td className="num">{row.shortage}</td>
                      <td className="num">{row.weeklyUse}</td>
                      <td className="num">{row.suggested}</td>
                      <td>{row.cheapestSupplier || '—'}</td>
                      <td>
                        {can('purchases', 'create') && row.cheapestSupplierId ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                              apiPost('/purchases', {
                                supplierId: row.cheapestSupplierId,
                                docDate: localIsoDate(),
                                paidNow: 0,
                                items: [
                                  {
                                    itemId: row.itemId,
                                    qty: row.suggested,
                                    unitCost: row.cheapestCost || 0,
                                  },
                                ],
                              }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل التحويل'))
                            }
                          >
                            تحويل لفاتورة شراء
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )
        ) : null}
      </PageBody>
    </main>
  )
}
