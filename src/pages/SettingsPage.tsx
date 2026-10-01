import { Lock, Unlock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ItemFormDialog, specText } from '../components/ItemFormDialog'
import { DataTable, Dialog, Field, LookupList, PageBody, PageError, PageHeader, SectionTitle, Tabs } from '../components/ui'
import { apiGet, apiPost, apiPut } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateText, monthLabel } from '../lib/format'
import { usePeriods } from '../lib/periods'
import { searchText, useTableQuery } from '../lib/table'
import type { AccountingPeriod, ExpenseType, IdName, Item } from '../lib/types'

type LookupKind = 'category' | 'unit' | 'type'

export function SettingsPage() {
  const { can } = useAuth()
  const writable = can('settings', 'create')
  const canViewPeriods = can('periods', 'view')
  const canClosePeriod = can('periods', 'close')
  const canReopenPeriod = can('periods', 'reopen')
  const { periods, reload: reloadPeriods } = usePeriods()
  const [pending, setPending] = useState<{ action: 'close' | 'reopen'; row: AccountingPeriod } | null>(null)
  const [tab, setTab] = useState('items')
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<IdName[]>([])
  const [units, setUnits] = useState<IdName[]>([])
  const [types, setTypes] = useState<ExpenseType[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newType, setNewType] = useState('')
  const [itemOpen, setItemOpen] = useState(false)
  const [lookupOpen, setLookupOpen] = useState<LookupKind | null>(null)
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
                    <td className="num">{row.code}</td>
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
                  <button type="button" className="btn btn-secondary" onClick={() => setLookupOpen('category')}>
                    إضافة
                  </button>
                ) : null}
              </div>
              <LookupList items={categories.map((row) => row.name)} />
            </section>
            <section>
              <div className="flex items-center justify-between gap-3 mb-3">
                <SectionTitle>وحدات</SectionTitle>
                {writable ? (
                  <button type="button" className="btn btn-secondary" onClick={() => setLookupOpen('unit')}>
                    إضافة
                  </button>
                ) : null}
              </div>
              <LookupList items={units.map((row) => row.name)} />
            </section>
            <section>
              <div className="flex items-center justify-between gap-3 mb-3">
                <SectionTitle>أنواع الواردات</SectionTitle>
                {writable ? (
                  <button type="button" className="btn btn-secondary" onClick={() => setLookupOpen('type')}>
                    إضافة
                  </button>
                ) : null}
              </div>
              <LookupList items={types.map((row) => `${row.name}${row.affectsStock ? ' (يؤثر على المخزون)' : ''}`)} />
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

      {lookupOpen ? (
        <Dialog
          title={lookupOpen === 'category' ? 'تصنيف جديد' : lookupOpen === 'unit' ? 'وحدة جديدة' : 'نوع مصروف جديد'}
          onClose={() => setLookupOpen(null)}
        >
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const request =
                lookupOpen === 'category'
                  ? apiPost('/categories', { name: newCategory })
                  : lookupOpen === 'unit'
                    ? apiPost('/units', { name: newUnit })
                    : apiPost('/expense-types', { name: newType, affectsStock: false })
              void request.then(() => {
                if (lookupOpen === 'category') setNewCategory('')
                if (lookupOpen === 'unit') setNewUnit('')
                if (lookupOpen === 'type') setNewType('')
                setLookupOpen(null)
                reload()
              })
            }}
          >
            <Field label="الاسم">
              <input
                className="input"
                value={lookupOpen === 'category' ? newCategory : lookupOpen === 'unit' ? newUnit : newType}
                onChange={(e) => {
                  if (lookupOpen === 'category') setNewCategory(e.target.value)
                  else if (lookupOpen === 'unit') setNewUnit(e.target.value)
                  else setNewType(e.target.value)
                }}
                required
              />
            </Field>
            <button type="submit" className="btn btn-primary mt-2">
              إضافة
            </button>
          </form>
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
            {writable ? (
              <button type="submit" className="btn btn-primary mt-2">
                حفظ الإعدادات
              </button>
            ) : null}
          </form>
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
