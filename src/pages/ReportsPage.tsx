import { ArrowUpLeft, ChevronDown, ChevronLeft } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { InvoiceDetailsDialog, InvoiceRefButton, type InvoiceViewTarget } from '../components/InvoiceDetailsDialog'
import { DataTable, EmptyState, Field, KpiCard, Money, PageBody, PageError, PageHeader, SectionTitle, Tabs } from '../components/ui'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, dateTimeText, localIsoDate, money, timeText } from '../lib/format'
import { searchText, useTableQuery } from '../lib/table'
import type { AgingReport, CashReport, CashRow, ItemProfitRow, PnlRow, ReorderRow } from '../lib/types'

function cashRowHref(row: CashRow): string | null {
  const type = row.targetType || row.refType
  const id = row.targetId ?? row.refId
  const ref = row.targetRef || row.refNo
  if (type === 'sale') {
    const params = new URLSearchParams()
    if (id != null) params.set('refId', String(id))
    if (ref) params.set('q', ref)
    const qs = params.toString()
    return qs ? `/revenue?${qs}` : '/revenue'
  }
  if (type === 'purchase') {
    const params = new URLSearchParams()
    if (id != null) params.set('refId', String(id))
    if (ref) params.set('q', ref)
    const qs = params.toString()
    return qs ? `/purchases?${qs}` : '/purchases'
  }
  if (type === 'customer') {
    const params = new URLSearchParams({ tab: 'receipts' })
    if (id != null) params.set('id', String(id))
    if (ref) params.set('q', ref)
    return `/customers?${params.toString()}`
  }
  if (type === 'supplier') {
    const params = new URLSearchParams({ tab: 'payments' })
    if (id != null) params.set('id', String(id))
    if (ref) params.set('q', ref)
    return `/suppliers?${params.toString()}`
  }
  if (type === 'expense') {
    const params = new URLSearchParams()
    if (id != null) params.set('refId', String(id))
    if (ref) params.set('q', ref)
    const qs = params.toString()
    return qs ? `/expenses?${qs}` : '/expenses'
  }
  if (row.label.startsWith('استلام')) {
    const token = row.label.replace(/^استلام\s*/, '').trim()
    if (token.includes('SO-')) {
      const m = /SO-\d+/.exec(token)
      return m ? `/revenue?q=${encodeURIComponent(m[0])}` : '/revenue'
    }
    return '/customers?tab=receipts'
  }
  if (row.label.startsWith('دفع')) {
    const token = row.label.replace(/^دفع\s*/, '').trim()
    if (token.includes('PO-')) {
      const m = /PO-\d+/.exec(token)
      return m ? `/purchases?q=${encodeURIComponent(m[0])}` : '/purchases'
    }
    return '/suppliers?tab=payments'
  }
  if (row.label.startsWith('وارد') || row.label.startsWith('مصروف')) {
    const token = row.label.replace(/^(وارد|مصروف)\s*/, '').trim()
    return token ? `/expenses?q=${encodeURIComponent(token)}` : '/expenses'
  }
  return null
}

type DatePreset = 'day' | 'week' | 'month' | 'year' | 'custom'

const PRESET_OPTIONS: { id: DatePreset; label: string }[] = [
  { id: 'day', label: 'اليوم' },
  { id: 'week', label: 'الأسبوع' },
  { id: 'month', label: 'الشهر' },
  { id: 'year', label: 'السنة' },
  { id: 'custom', label: 'مخصص' },
]

function computeRange(preset: DatePreset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date()
  const todayStr = localIsoDate(now)

  if (preset === 'day') {
    return { from: todayStr, to: todayStr }
  }
  if (preset === 'week') {
    const dayOfWeek = now.getDay() // 0 = Sun, 6 = Sat
    const daysSinceSaturday = (dayOfWeek + 1) % 7
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceSaturday)
    return { from: localIsoDate(start), to: todayStr }
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: localIsoDate(start), to: localIsoDate(end) }
  }
  if (preset === 'year') {
    const year = now.getFullYear()
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
  const from = customFrom || todayStr
  const to = customTo || from
  return from <= to ? { from, to } : { from: to, to: from }
}

export function ReportsPage() {
  const { can } = useAuth()
  const [tab, setTab] = useState('pnl')
  const [preset, setPreset] = useState<DatePreset>('month')
  const [customFrom, setCustomFrom] = useState(() => {
    const now = new Date()
    return localIsoDate(new Date(now.getFullYear(), now.getMonth(), 1))
  })
  const [customTo, setCustomTo] = useState(() => localIsoDate())
  const [cashDate, setCashDate] = useState(() => localIsoDate())

  const [pnl, setPnl] = useState<PnlRow[]>([])
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({})
  const [cash, setCash] = useState<CashReport | null>(null)
  const [aging, setAging] = useState<AgingReport | null>(null)
  const [profit, setProfit] = useState<ItemProfitRow[]>([])
  const [reorder, setReorder] = useState<ReorderRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [detailTarget, setDetailTarget] = useState<InvoiceViewTarget | null>(null)

  const range = useMemo(() => computeRange(preset, customFrom, customTo), [preset, customFrom, customTo])
  const isTimeFilteredTab = tab === 'pnl' || tab === 'cash' || tab === 'profit'

  const pnlTotals = useMemo(
    () =>
      pnl.reduce(
        (acc, row) => ({
          revenue: acc.revenue + Number(row.revenue || 0),
          cogs: acc.cogs + Number(row.cogs || 0),
          gross: acc.gross + Number(row.gross || 0),
          expenses: acc.expenses + Number(row.expenses || 0),
          net: acc.net + Number(row.net || 0),
        }),
        { revenue: 0, cogs: 0, gross: 0, expenses: 0, net: 0 },
      ),
    [pnl],
  )

  const pnlTable = useTableQuery(pnl, (row) =>
    searchText(
      row.period,
      row.closed ? 'مقفول' : '',
      ...(row.weeks || []).flatMap((w) => [w.label, w.fromDate, w.toDate, ...w.days.map((d) => d.date)]),
    ),
  )
  const cashTable = useTableQuery(cash?.rows || [], (row) =>
    searchText(dateTimeText(row.at), timeText(row.at), row.label, row.in, row.out, row.balance),
  )
  const agingCustomers = useTableQuery(aging?.customers || [], (row) => searchText(row.partyName, row.d0, row.d31, row.d60))
  const agingSuppliers = useTableQuery(aging?.suppliers || [], (row) => searchText(row.partyName, row.d0, row.d31, row.d60))
  const profitTable = useTableQuery(profit, (row) => searchText(row.itemName, row.revenue, row.cost, row.profit, row.margin, row.weight))
  const reorderTable = useTableQuery(reorder, (row) =>
    searchText(row.itemName, row.onHand, row.minQty, row.shortage, row.weeklyUse, row.suggested, row.cheapestSupplier),
  )

  useEffect(() => {
    const qs = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
    void apiGet<PnlRow[]>(`/reports/pnl${qs}`)
      .then(setPnl)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'تعذر التحميل'))
    void apiGet<CashReport>(`/reports/cash${qs}`).then(setCash)
    void apiGet<ItemProfitRow[]>(`/reports/item-profit${qs}`).then(setProfit)
  }, [range.from, range.to])

  useEffect(() => {
    void apiGet<AgingReport>('/reports/aging').then(setAging)
    void apiGet<ReorderRow[]>('/reports/reorder').then(setReorder)
  }, [])

  return (
    <main>
      <PageHeader title="التقارير">
        <Tabs
          tabs={[
            { id: 'pnl', label: 'الأرباح والخسائر' },
            { id: 'cash', label: 'يومية' },
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
        {isTimeFilteredTab ? (
          <div className="page-toolbar">
            <div className="filter-pills" role="group" aria-label="فلتر الفترة">
              {PRESET_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="filter-pill"
                  aria-pressed={preset === option.id}
                  onClick={() => setPreset(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {tab === 'cash' && preset === 'day' ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="تاريخ اليومية">
                  <input
                    type="date"
                    className="input num"
                    value={cashDate}
                    onChange={(e) => {
                      const val = e.target.value || localIsoDate()
                      setCashDate(val)
                      setCustomFrom(val)
                      setCustomTo(val)
                      if (val !== localIsoDate()) {
                        setPreset('custom')
                      }
                    }}
                  />
                </Field>
              </div>
            ) : preset === 'custom' ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="من تاريخ">
                  <input
                    type="date"
                    className="input num"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </Field>
                <Field label="إلى تاريخ">
                  <input
                    type="date"
                    className="input num"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </Field>
              </div>
            ) : (
              <span className="text-xs text-[var(--color-muted)] pb-2">
                الفترة: <span className="num font-semibold text-[var(--color-text)]">{dateText(range.from)}</span>
                {range.to !== range.from ? (
                  <>
                    {' — '}
                    <span className="num font-semibold text-[var(--color-text)]">{dateText(range.to)}</span>
                  </>
                ) : null}
              </span>
            )}
          </div>
        ) : null}

        {tab === 'pnl' ? (
          <>
            <div className="kpi-grid mb-5">
              <KpiCard label="إجمالي الصادرات" value={<span className="num">{money(pnlTotals.revenue)}</span>} />
              <KpiCard label="تكلفة المبيعات" value={<span className="num">{money(pnlTotals.cogs)}</span>} />
              <KpiCard label="المصروفات العمومية" value={<span className="num">{money(pnlTotals.expenses)}</span>} />
              <KpiCard label="صافي الربح" value={<span className="num">{money(pnlTotals.net)}</span>} />
            </div>
            {!pnl.length ? (
              <EmptyState title="مفيش بيانات في الفترة دي" hint="التقرير هيتبني بعد اعتماد فواتير البيع والمصروفات العمومية خلال الفترة المختارة." />
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
                      <th>الفترة</th>
                      <th>صادرات</th>
                      <th>تكلفة مبيعات</th>
                      <th>ربح إجمالي</th>
                      <th>مصاريف عمومية</th>
                      <th>صافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlTable.pageRows.map((row) => {
                      const weeks = row.weeks || []
                      const hasWeeks = weeks.length > 0
                      const isMonthOpen = Boolean(expandedMonths[row.period])
                      return (
                        <Fragment key={row.period}>
                          <tr
                            className={hasWeeks ? 'tree-row tree-row-month cursor-pointer' : 'tree-row tree-row-month'}
                            onClick={() => {
                              if (!hasWeeks) return
                              setExpandedMonths((prev) => ({ ...prev, [row.period]: !prev[row.period] }))
                            }}
                          >
                            <td>
                              <div className="tree-cell">
                                {hasWeeks ? (
                                  <span className="tree-toggle" aria-hidden>
                                    {isMonthOpen ? <ChevronDown size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
                                  </span>
                                ) : (
                                  <span className="tree-spacer" aria-hidden />
                                )}
                                <span className="num font-semibold">{row.period}</span>
                                {row.closed ? <span className="tag tag-accent mr-2">مقفول</span> : null}
                              </div>
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

                          {isMonthOpen &&
                            weeks.map((week) => {
                              const hasDays = week.days.length > 0
                              const isWeekOpen = Boolean(expandedWeeks[week.key])
                              return (
                                <Fragment key={week.key}>
                                  <tr
                                    className={hasDays ? 'tree-row tree-row-week cursor-pointer' : 'tree-row tree-row-week'}
                                    onClick={() => {
                                      if (!hasDays) return
                                      setExpandedWeeks((prev) => ({ ...prev, [week.key]: !prev[week.key] }))
                                    }}
                                  >
                                    <td>
                                      <div className="tree-cell tree-level-1">
                                        {hasDays ? (
                                          <span className="tree-toggle" aria-hidden>
                                            {isWeekOpen ? (
                                              <ChevronDown size={15} strokeWidth={2} />
                                            ) : (
                                              <ChevronLeft size={15} strokeWidth={2} />
                                            )}
                                          </span>
                                        ) : (
                                          <span className="tree-spacer" aria-hidden />
                                        )}
                                        <span className="font-medium">{week.label}</span>
                                        <span className="num text-xs text-[var(--color-muted)]">
                                          ({week.fromDate.slice(8)}–{week.toDate.slice(8)})
                                        </span>
                                      </div>
                                    </td>
                                    <td>
                                      <Money value={week.revenue} />
                                    </td>
                                    <td>
                                      <Money value={week.cogs} />
                                    </td>
                                    <td>
                                      <Money value={week.gross} />
                                    </td>
                                    <td>
                                      <Money value={week.expenses} />
                                    </td>
                                    <td className="font-semibold">
                                      <Money value={week.net} />
                                    </td>
                                  </tr>
                                  {isWeekOpen &&
                                    week.days.map((day) => (
                                      <tr key={day.date} className="tree-row tree-row-day">
                                        <td>
                                          <div className="tree-cell tree-level-2">
                                            <span className="tree-dot" aria-hidden />
                                            <span className="num">{day.date}</span>
                                          </div>
                                        </td>
                                        <td>
                                          <Money value={day.revenue} />
                                        </td>
                                        <td>
                                          <Money value={day.cogs} />
                                        </td>
                                        <td>
                                          <Money value={day.gross} />
                                        </td>
                                        <td>
                                          <Money value={day.expenses} />
                                        </td>
                                        <td className="font-medium">
                                          <Money value={day.net} />
                                        </td>
                                      </tr>
                                    ))}
                                </Fragment>
                              )
                            })}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </DataTable>
            )}
          </>
        ) : null}

        {tab === 'cash' ? (
          <>
            <div className="kpi-grid mb-5">
              <KpiCard label="رصيد البداية" value={<span className="num">{money(cash?.opening || 0)}</span>} />
              <KpiCard label="رصيد النهاية" value={<span className="num">{money(cash?.closing || 0)}</span>} />
            </div>
            {!cash?.rows.length ? (
              <EmptyState title="مفيش حركة نقدية في الفترة دي" hint="الاستلام ودفعات الموردين والواردات العمومية تظهر هنا. الآجل مستبعد." />
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
                    {cashTable.pageRows.map((row, index) => {
                      const invoiceKind =
                        row.refType === 'sale' || row.refType === 'purchase'
                          ? row.refType
                          : row.targetType === 'sale' || row.targetType === 'purchase'
                            ? row.targetType
                            : null
                      const invoiceId = row.refId ?? (invoiceKind ? row.targetId : null) ?? null
                      const href = cashRowHref(row)
                      return (
                        <tr key={`${row.at}-${index}`}>
                          <td className="num">{dateTimeText(row.at)}</td>
                          <td>
                            <div className="flex items-center gap-2 flex-wrap">
                              {href ? (
                                <Link
                                  to={href}
                                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-700)] no-underline hover:underline"
                                >
                                  <span>{row.label}</span>
                                  <ArrowUpLeft size={14} strokeWidth={2} aria-hidden />
                                </Link>
                              ) : (
                                row.label
                              )}
                              {invoiceKind && invoiceId != null ? (
                                <InvoiceRefButton
                                  label="عرض الفاتورة"
                                  onClick={() =>
                                    setDetailTarget(
                                      invoiceKind === 'sale'
                                        ? { kind: 'sale', id: invoiceId }
                                        : { kind: 'purchase', id: invoiceId },
                                    )
                                  }
                                />
                              ) : null}
                            </div>
                          </td>
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
                      )
                    })}
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
            <EmptyState title="مفيش ربحية أصناف في الفترة دي" hint="بعد اعتماد فواتير البيع خلال الفترة المختارة هيتحسب الصادر والتكلفة والهامش." />
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

      <InvoiceDetailsDialog
        target={detailTarget}
        onClose={() => setDetailTarget(null)}
        onSelectTarget={setDetailTarget}
      />
    </main>
  )
}
