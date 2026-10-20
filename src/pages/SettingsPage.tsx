import { Lock, Pencil, Trash2, Unlock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ItemFormDialog, specText } from '../components/ItemFormDialog'
import { DataTable, Dialog, Field, LookupList, PageBody, PageError, PageHeader, SectionTitle, Tabs } from '../components/ui'
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, money, monthLabel, qty } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { AccountingPeriod, ExpenseType, IdName, Item } from '../lib/types'

type LookupKind = 'category' | 'unit' | 'type'

type LookupModalState = {
  mode: 'create' | 'edit'
  kind: LookupKind
  id?: number
}

type DeleteLookupState = {
  kind: LookupKind
  id: number
  name: string
}

export function SettingsPage() {
  const { can, refreshMe } = useAuth()
  const writable = can('settings', 'create')
  const canViewPeriods = can('periods', 'view')
  const canClosePeriod = can('periods', 'close')
  const canReopenPeriod = can('periods', 'reopen')
  const { periods, reload: reloadPeriods } = usePeriods()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pending, setPending] = useState<{ action: 'close' | 'reopen'; row: AccountingPeriod } | null>(null)
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'items')
  const [items, setItems] = useState<Item[]>([])
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [categories, setCategories] = useState<IdName[]>([])
  const [units, setUnits] = useState<IdName[]>([])
  const [types, setTypes] = useState<ExpenseType[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [lookupName, setLookupName] = useState('')
  const [lookupAffectsStock, setLookupAffectsStock] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [lookupModal, setLookupModal] = useState<LookupModalState | null>(null)
  const [deleteLookup, setDeleteLookup] = useState<DeleteLookupState | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const itemsTable = useTableQuery(items, (row) =>
    searchText(row.code, row.name, row.categoryName, row.length, row.width, row.thickness, row.unitName, row.minQty),
  )
  const periodsTable = useTableQuery(periods, (row) =>
    searchText(
      row.yearMonth,
      monthLabel(row.yearMonth),
      row.status === 'closed' ? 'مقفولة' : 'مفتوحة',
      row.closedByName,
      dateText(row.closedAt),
    ),
  )

  function reload() {
    void apiGet<Item[]>('/items').then(setItems)
    void apiGet<IdName[]>('/categories').then(setCategories)
    void apiGet<IdName[]>('/units').then(setUnits)
    void apiGet<ExpenseType[]>('/expense-types').then(setTypes)
    void apiGet<Record<string, string>>('/settings').then(setSettings)
  }

  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    if (requestedTab === 'items' || requestedTab === 'lookups' || requestedTab === 'rules' || (requestedTab === 'periods' && canViewPeriods)) {
      setTab(requestedTab)
    }
  }, [searchParams, canViewPeriods])

  useEffect(() => {
    const refId = Number(searchParams.get('refId'))
    if (!refId || items.length === 0) return
    const target = items.find((row) => row.id === refId)
    if (target) {
      itemsTable.setQuery(target.code)
      setSelectedItem(target)
    }
  }, [searchParams, items])

  function clearRefParam() {
    if (!searchParams.has('refId')) return
    const next = new URLSearchParams(searchParams)
    next.delete('refId')
    setSearchParams(next, { replace: true })
  }

  return (
    <main>
      <PageHeader title="الإعدادات">
        <Tabs
          tabs={[
            { id: 'items', label: 'دليل الأصناف' },
            { id: 'lookups', label: 'أنواع وتصنيفات' },
            { id: 'rules', label: 'قواعد الفائض' },
            ...(canViewPeriods ? [{ id: 'periods', label: 'إقفال الفترات' }] : []),
          ]}
          value={tab}
          onChange={setTab}
        />
      </PageHeader>
      <PageError>{error}</PageError>
      <PageBody>
        {tab === 'items' ? (
          <DataTable
            query={itemsTable.query}
            onQueryChange={itemsTable.setQuery}
            page={itemsTable.page}
            pageCount={itemsTable.pageCount}
            filteredCount={itemsTable.filteredCount}
            totalCount={itemsTable.totalCount}
            onPageChange={itemsTable.setPage}
            emptyTitle="مفيش أصناف"
            emptyHint="أضف صنف من الدليل عشان يظهر في فواتير الشراء والبيع."
            toolbar={
              writable ? (
                <button type="button" className="btn btn-primary" onClick={() => setItemOpen(true)}>
                  إضافة صنف
                </button>
              ) : null
            }
          >
            <table className="table">
              <thead>
                <tr>
                  <th>كود</th>
                  <th>بيان</th>
                  <th>تصنيف</th>
                  <th>طول</th>
                  <th>عرض</th>
                  <th>تخانة</th>
                  <th>وحدة</th>
                  <th>حد التنبيه</th>
                </tr>
              </thead>
              <tbody>
                {itemsTable.pageRows.map((row) => (
                  <tr key={row.id}>
                    <td className="num">
                      <button
                        type="button"
                        className="btn btn-ghost num"
                        onClick={() => setSelectedItem(row)}
                      >
                        {row.code}
                      </button>
                    </td>
                    <td>{row.name}</td>
                    <td>{row.categoryName}</td>
                    <td>{specText(row.length)}</td>
                    <td>{specText(row.width)}</td>
                    <td>{specText(row.thickness)}</td>
                    <td>{row.unitName}</td>
                    <td className="num">{row.minQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : null}

        {tab === 'lookups' ? (
          <div className="grid md:grid-cols-3 gap-6">
            <section>
              <div className="flex items-center justify-between gap-3 mb-3">
                <SectionTitle>تصنيفات</SectionTitle>
                {writable ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setError(null)
                      setLookupName('')
                      setLookupModal({ mode: 'create', kind: 'category' })
                    }}
                  >
                    إضافة
                  </button>
                ) : null}
              </div>
              <LookupList
                items={
                  categories.length === 0
                    ? [<span key="empty" className="text-[var(--color-muted)] text-sm">مفيش تصنيفات</span>]
                    : categories.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-2">
                          <span>{row.name}</span>
                          {writable ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="btn btn-ghost"
                                title="تعديل"
                                aria-label={`تعديل ${row.name}`}
                                onClick={() => {
                                  setError(null)
                                  setLookupName(row.name)
                                  setLookupModal({ mode: 'edit', kind: 'category', id: row.id })
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                title="حذف"
                                aria-label={`حذف ${row.name}`}
                                onClick={() => {
                                  setError(null)
                                  setDeleteLookup({ kind: 'category', id: row.id, name: row.name })
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))
                }
              />
            </section>
            <section>
              <div className="flex items-center justify-between gap-3 mb-3">
                <SectionTitle>وحدات</SectionTitle>
                {writable ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setError(null)
                      setLookupName('')
                      setLookupModal({ mode: 'create', kind: 'unit' })
                    }}
                  >
                    إضافة
                  </button>
                ) : null}
              </div>
              <LookupList
                items={
                  units.length === 0
                    ? [<span key="empty" className="text-[var(--color-muted)] text-sm">مفيش وحدات</span>]
                    : units.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-2">
                          <span>{row.name}</span>
                          {writable ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="btn btn-ghost"
                                title="تعديل"
                                aria-label={`تعديل ${row.name}`}
                                onClick={() => {
                                  setError(null)
                                  setLookupName(row.name)
                                  setLookupModal({ mode: 'edit', kind: 'unit', id: row.id })
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                title="حذف"
                                aria-label={`حذف ${row.name}`}
                                onClick={() => {
                                  setError(null)
                                  setDeleteLookup({ kind: 'unit', id: row.id, name: row.name })
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))
                }
              />
            </section>
            <section>
              <div className="flex items-center justify-between gap-3 mb-3">
                <SectionTitle>أنواع المصروفات العمومية</SectionTitle>
                {writable ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setError(null)
                      setLookupName('')
                      setLookupAffectsStock(false)
                      setLookupModal({ mode: 'create', kind: 'type' })
                    }}
                  >
                    إضافة
                  </button>
                ) : null}
              </div>
              <LookupList
                items={
                  types.length === 0
                    ? [<span key="empty" className="text-[var(--color-muted)] text-sm">مفيش أنواع مصروفات</span>]
                    : types.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{row.name}</span>
                            {row.affectsStock ? <span className="tag tag-accent">يؤثر على المخزون</span> : null}
                          </div>
                          {writable ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="btn btn-ghost"
                                title="تعديل"
                                aria-label={`تعديل ${row.name}`}
                                onClick={() => {
                                  setError(null)
                                  setLookupName(row.name)
                                  setLookupAffectsStock(row.affectsStock)
                                  setLookupModal({ mode: 'edit', kind: 'type', id: row.id })
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                title="حذف"
                                aria-label={`حذف ${row.name}`}
                                onClick={() => {
                                  setError(null)
                                  setDeleteLookup({ kind: 'type', id: row.id, name: row.name })
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))
                }
              />
            </section>
          </div>
        ) : null}

        {tab === 'rules' ? (
          <div>
            {writable ? (
              <button type="button" className="btn btn-primary mb-4" onClick={() => setRulesOpen(true)}>
                تعديل القواعد
              </button>
            ) : null}
            <dl className="card grid gap-3 max-w-xl m-0">
              <div>
                <dt className="text-xs text-[var(--color-muted)]">أقل طول يستحق تسجيل فائض</dt>
                <dd className="m-0 num font-semibold">{settings.surplus_min_length || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-muted)]">تكلفة الفائض</dt>
                <dd className="m-0 num font-semibold">{settings.surplus_cost || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-muted)]">حد التنبيه الافتراضي</dt>
                <dd className="m-0 num font-semibold">{settings.default_min_qty || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-muted)]">مدة الجلسة قبل الخروج التلقائي (دقيقة)</dt>
                <dd className="m-0 num font-semibold">{settings.session_timeout_minutes || '30'}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {tab === 'periods' && canViewPeriods ? (
          <div>
            <p className="mt-0 mb-6 text-sm text-[var(--color-muted)]">
              قفل الشهر يوقف الاعتماد والدفع والوارد والجرد لو تاريخ الترحيل جوه الفترة. المسودة تتعمل عادي.
            </p>
            <DataTable
              query={periodsTable.query}
              onQueryChange={periodsTable.setQuery}
              page={periodsTable.page}
              pageCount={periodsTable.pageCount}
              filteredCount={periodsTable.filteredCount}
              totalCount={periodsTable.totalCount}
              onPageChange={periodsTable.setPage}
              emptyTitle="مفيش فترات"
              emptyHint="الفترات المحاسبية هتظهر هنا."
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>الشهر</th>
                    <th>الحالة</th>
                    <th>القفل</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {periodsTable.pageRows.map((row) => {
                    const closed = row.status === 'closed'
                    return (
                      <tr key={row.yearMonth}>
                        <td>
                          <span className="num">{row.yearMonth}</span> — {monthLabel(row.yearMonth)}
                        </td>
                        <td>
                          <span className={closed ? 'tag tag-accent' : 'tag tag-ok'}>{closed ? 'مقفولة' : 'مفتوحة'}</span>
                        </td>
                        <td>
                          {closed && row.closedAt ? `${row.closedByName || '—'} · ${dateText(row.closedAt)}` : '—'}
                        </td>
                        <td>
                          {closed ? (
                            canReopenPeriod ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setPending({ action: 'reopen', row })}
                              >
                                <Unlock size={16} />
                                فتح الفترة
                              </button>
                            ) : null
                          ) : canClosePeriod ? (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => setPending({ action: 'close', row })}
                            >
                              <Lock size={16} />
                              قفل الفترة
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </DataTable>
          </div>
        ) : null}
      </PageBody>

      {itemOpen ? (
        <ItemFormDialog
          onClose={() => setItemOpen(false)}
          onCreated={() => reload()}
          onError={setError}
          showMinQty
          showOpeningBalance
        />
      ) : null}

      {lookupModal ? (
        <Dialog
          title={
            lookupModal.mode === 'create'
              ? lookupModal.kind === 'category'
                ? 'تصنيف جديد'
                : lookupModal.kind === 'unit'
                  ? 'وحدة جديدة'
                  : 'نوع مصروف جديد'
              : lookupModal.kind === 'category'
                ? 'تعديل تصنيف'
                : lookupModal.kind === 'unit'
                  ? 'تعديل وحدة'
                  : 'تعديل نوع مصروف'
          }
          onClose={() => setLookupModal(null)}
        >
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const trimmed = lookupName.trim()
              if (!trimmed) return
              const isCreate = lookupModal.mode === 'create'
              const request =
                lookupModal.kind === 'category'
                  ? isCreate
                    ? apiPost('/categories', { name: trimmed })
                    : apiPut(`/categories/${lookupModal.id}`, { id: lookupModal.id, name: trimmed })
                  : lookupModal.kind === 'unit'
                    ? isCreate
                      ? apiPost('/units', { name: trimmed })
                      : apiPut(`/units/${lookupModal.id}`, { id: lookupModal.id, name: trimmed })
                    : isCreate
                      ? apiPost('/expense-types', { name: trimmed, affectsStock: lookupAffectsStock })
                      : apiPut(`/expense-types/${lookupModal.id}`, {
                          id: lookupModal.id,
                          name: trimmed,
                          affectsStock: lookupAffectsStock,
                        })
              void request
                .then(() => {
                  setLookupName('')
                  setLookupAffectsStock(false)
                  setLookupModal(null)
                  reload()
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'فشل الحفظ')
                })
            }}
          >
            <Field label="الاسم">
              <input
                className="input"
                value={lookupName}
                onChange={(e) => setLookupName(e.target.value)}
                required
              />
            </Field>
            {lookupModal.kind === 'type' ? (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={lookupAffectsStock}
                  onChange={(e) => setLookupAffectsStock(e.target.checked)}
                />
                <span>يؤثر على المخزون (هالك)</span>
              </label>
            ) : null}
            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn btn-primary">
                {lookupModal.mode === 'create' ? 'إضافة' : 'حفظ التعديلات'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setLookupModal(null)}>
                إلغاء
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {deleteLookup ? (
        <Dialog
          title={
            deleteLookup.kind === 'category'
              ? 'تأكيد حذف التصنيف'
              : deleteLookup.kind === 'unit'
                ? 'تأكيد حذف الوحدة'
                : 'تأكيد حذف نوع المصروف'
          }
          onClose={() => setDeleteLookup(null)}
        >
          <p className="m-0 mb-4">
            هل أنت متأكد من حذف <strong>{deleteLookup.name}</strong>؟
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const path =
                  deleteLookup.kind === 'category'
                    ? `/categories/${deleteLookup.id}`
                    : deleteLookup.kind === 'unit'
                      ? `/units/${deleteLookup.id}`
                      : `/expense-types/${deleteLookup.id}`
                void apiDelete(path)
                  .then(() => {
                    setDeleteLookup(null)
                    reload()
                  })
                  .catch((err: unknown) => {
                    setDeleteLookup(null)
                    setError(err instanceof Error ? err.message : 'فشل الحذف')
                  })
              }}
            >
              حذف
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteLookup(null)}>
              إلغاء
            </button>
          </div>
        </Dialog>
      ) : null}

      {rulesOpen ? (
        <Dialog title="تعديل قواعد الفائض" onClose={() => setRulesOpen(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!writable) return
              void apiPut('/settings', settings)
                .then((rows) => {
                  setSettings(rows as Record<string, string>)
                  setRulesOpen(false)
                  void refreshMe()
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الحفظ'))
            }}
          >
            <Field label="أقل طول يستحق تسجيل فائض">
              <input
                className="input num"
                value={settings.surplus_min_length || ''}
                onChange={(e) => setSettings((current) => ({ ...current, surplus_min_length: e.target.value }))}
                disabled={!writable}
              />
            </Field>
            <Field label="تكلفة الفائض">
              <input
                className="input num"
                value={settings.surplus_cost || ''}
                onChange={(e) => setSettings((current) => ({ ...current, surplus_cost: e.target.value }))}
                disabled={!writable}
              />
            </Field>
            <Field label="حد التنبيه الافتراضي">
              <input
                className="input num"
                value={settings.default_min_qty || ''}
                onChange={(e) => setSettings((current) => ({ ...current, default_min_qty: e.target.value }))}
                disabled={!writable}
              />
            </Field>
            <Field label="مدة الجلسة قبل الخروج التلقائي (دقيقة)">
              <input
                type="number"
                min={1}
                className="input num"
                value={settings.session_timeout_minutes ?? '30'}
                onChange={(e) => setSettings((current) => ({ ...current, session_timeout_minutes: e.target.value }))}
                disabled={!writable}
              />
            </Field>
            {writable ? (
              <button type="submit" className="btn btn-primary mt-2">
                حفظ الإعدادات
              </button>
            ) : null}
          </form>
        </Dialog>
      ) : null}

      {selectedItem ? (
        <Dialog
          title={`تفاصيل صنف ${selectedItem.code}`}
          onClose={() => {
            setSelectedItem(null)
            clearRefParam()
          }}
        >
          <dl className="card grid gap-3 m-0 mb-4">
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">الكود</dt>
              <dd className="m-0 num font-bold">{selectedItem.code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">البيان</dt>
              <dd className="m-0 font-bold">{selectedItem.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">التصنيف</dt>
              <dd className="m-0">{selectedItem.categoryName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">المقاسات (طول × عرض × تخانة)</dt>
              <dd className="m-0 num">
                {specText(selectedItem.length)} × {specText(selectedItem.width)} × {specText(selectedItem.thickness)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">الوحدة / حد التنبيه</dt>
              <dd className="m-0 num">
                {selectedItem.unitName} · حد تنبيه {qty(selectedItem.minQty)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">الرصيد المتاح</dt>
              <dd className="m-0 num font-bold">
                {qty(selectedItem.onHand)} {selectedItem.unitName}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-[var(--color-muted)]">متوسط التكلفة / قيمة المخزون</dt>
              <dd className="m-0 num font-bold">
                {money(selectedItem.avgCost)} / {money(selectedItem.stockValue)}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelectedItem(null)
              clearRefParam()
            }}
          >
            إغلاق
          </button>
        </Dialog>
      ) : null}

      {pending ? (
        <Dialog
          title={pending.action === 'close' ? 'تأكيد قفل الفترة' : 'تأكيد فتح الفترة'}
          onClose={() => setPending(null)}
        >
          {pending.action === 'close' ? (
            <p className="m-0 mb-4">
              قفل {monthLabel(pending.row.yearMonth)} هيوقف الاعتماد والدفع والوارد والجرد والعكس لو تاريخ الترحيل
              داخل الشهر. المسودات تفضل تتعمل.
            </p>
          ) : (
            <p className="m-0 mb-4">
              الفتح هيسمح تعديل أرقام {monthLabel(pending.row.yearMonth)} بعد ما اتقفل دفتريًا. الإجراء هيتسجل في سجل
              المراجعة.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const path =
                  pending.action === 'close'
                    ? `/periods/${pending.row.yearMonth}/close`
                    : `/periods/${pending.row.yearMonth}/reopen`
                void apiPost<AccountingPeriod>(path)
                  .then(() => {
                    setPending(null)
                    reloadPeriods()
                  })
                  .catch((err: unknown) => {
                    setPending(null)
                    setError(err instanceof Error ? err.message : 'فشل الإجراء')
                  })
              }}
            >
              {pending.action === 'close' ? 'قفل الفترة' : 'فتح الفترة'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>
              إلغاء
            </button>
          </div>
        </Dialog>
      ) : null}
    </main>
  )
}
