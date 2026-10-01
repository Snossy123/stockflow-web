import { useEffect, useState } from 'react'
import { DataTable, Dialog, EmptyState, Field, PageBody, PageError, PageHeader, Tabs } from '../components/ui'
import { apiGet, apiPost } from '../lib/api'
import { dateText } from '../lib/format'
import { searchText, useTableQuery } from '../lib/table'
import type { LoginEvent, RoleMatrix, UserRow } from '../lib/types'

export function UsersPage() {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleMatrix[]>([])
  const [events, setEvents] = useState<LoginEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('arafa123')
  const [roleId, setRoleId] = useState(4)
  const usersTable = useTableQuery(users, (row) =>
    searchText(row.name, row.username, row.roleName, row.status === 'active' ? 'نشط' : 'موقوف', dateText(row.lastLoginAt)),
  )
  const eventsTable = useTableQuery(events, (row) =>
    searchText(row.userName, row.username, row.success ? 'نجاح' : 'فشل', dateText(row.occurredAt)),
  )

  function reload() {
    void apiGet<UserRow[]>('/users').then(setUsers)
    void apiGet<RoleMatrix[]>('/roles').then(setRoles)
    void apiGet<LoginEvent[]>('/login-events').then(setEvents)
  }

  useEffect(() => {
    reload()
  }, [])

  return (
    <main>
      <PageHeader title="المستخدمين والصلاحيات">
        <Tabs
          tabs={[
            { id: 'users', label: 'المستخدمين' },
            { id: 'roles', label: 'الأدوار' },
            { id: 'audit', label: 'سجل الدخول' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </PageHeader>
      <PageError>{error}</PageError>
      <PageBody>
        {tab === 'users' ? (
          <DataTable
            query={usersTable.query}
            onQueryChange={usersTable.setQuery}
            page={usersTable.page}
            pageCount={usersTable.pageCount}
            filteredCount={usersTable.filteredCount}
            totalCount={usersTable.totalCount}
            onPageChange={usersTable.setPage}
            toolbar={
              <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
                إضافة مستخدم
              </button>
            }
          >
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>آخر دخول</th>
                </tr>
              </thead>
              <tbody>
                {usersTable.pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td className="num">{row.username}</td>
                    <td>{row.roleName}</td>
                    <td>
                      <span className={row.status === 'active' ? 'tag tag-ok' : 'tag tag-accent'}>
                        {row.status === 'active' ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td className="num">{dateText(row.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : null}

        {tab === 'roles' ? (
          <div className="grid gap-4">
            {roles.map((role) => (
              <article key={role.id} className="card">
                <div className="card-title">
                  {role.name} <span className="text-sm font-normal text-[var(--color-muted)]">{role.code}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((perm) => (
                    <span key={`${perm.resource}-${perm.action}`} className="tag">
                      {perm.resource}:{perm.action}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {tab === 'audit' ? (
          !events.length ? (
            <EmptyState title="مفيش سجل دخول" hint="محاولات الدخول هتتسجل هنا." />
          ) : (
            <DataTable
              query={eventsTable.query}
              onQueryChange={eventsTable.setQuery}
              page={eventsTable.page}
              pageCount={eventsTable.pageCount}
              filteredCount={eventsTable.filteredCount}
              totalCount={eventsTable.totalCount}
              onPageChange={eventsTable.setPage}
              emptyTitle="مفيش سجل دخول"
              emptyHint="محاولات الدخول هتتسجل هنا."
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>النتيجة</th>
                    <th>الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsTable.pageRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.userName || row.username}</td>
                      <td>
                        <span className={row.success ? 'tag tag-ok' : 'tag tag-accent'}>{row.success ? 'نجاح' : 'فشل'}</span>
                      </td>
                      <td className="num">{dateText(row.occurredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )
        ) : null}
      </PageBody>

      {formOpen ? (
        <Dialog title="مستخدم جديد" onClose={() => setFormOpen(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void apiPost<UserRow>('/users', { name, username, password, roleId, status: 'active' })
                .then(() => {
                  setName('')
                  setUsername('')
                  setFormOpen(false)
                  reload()
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'فشل الحفظ'))
            }}
          >
            <Field label="الاسم">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="اسم المستخدم">
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </Field>
            <Field label="كلمة المرور">
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="الدور">
              <select className="input" value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" className="btn btn-primary mt-2">
              إضافة مستخدم
            </button>
          </form>
        </Dialog>
      ) : null}
    </main>
  )
}
