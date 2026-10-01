import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { money } from '../lib/format'

export function PageHeader({
  kicker,
  title,
  actions,
  children,
}: {
  kicker?: string
  title: string
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {kicker ? <div className="card-kicker mb-1.5">{kicker}</div> : null}
        <h1 className="text-[32px] m-0">{title}</h1>
        {children}
      </div>
      {actions ? <div className="flex gap-2 pb-1">{actions}</div> : null}
    </header>
  )
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `page-body ${className}` : 'page-body'}>{children}</div>
}

export function PageError({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="page-error">{children}</p>
}

export function SectionTitle({ kicker, children }: { kicker?: string; children: ReactNode }) {
  return (
    <h2 className="section-title">
      {kicker ? <span className="section-kicker">{kicker}</span> : null}
      {children}
    </h2>
  )
}

export function Tabs({
  tabs,
  value,
  onChange,
  className = 'mt-4',
}: {
  tabs: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={`tabs ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  onClear,
}: {
  title: string
  hint: string
  onClear?: () => void
}) {
  return (
    <div className="card max-w-xl my-2">
      <div className="card-title">{title}</div>
      <p className="m-0 text-sm text-[var(--color-muted)]">{hint}</p>
      {onClear ? (
        <button type="button" className="btn btn-secondary mt-3" onClick={onClear}>
          مسح الفلتر
        </button>
      ) : null}
    </div>
  )
}

export function Dialog({
  title,
  children,
  onClose,
  size = 'sm',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  size?: 'sm' | 'xl'
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className={size === 'xl' ? 'dialog dialog-xl' : 'dialog'}
        role="dialog"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h2 id="dialog-title" className="text-[20px] m-0">
            {title}
          </h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="إغلاق">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Money({ value }: { value: number | null | undefined }) {
  return <span className="num">{money(value)}</span>
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="field m-0">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon?: ReactNode
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <article className="kpi-card">
      {icon ? <div className="kpi-icon">{icon}</div> : null}
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {hint ? <p className="kpi-hint">{hint}</p> : null}
    </article>
  )
}

export function Panel({
  title,
  children,
  footer,
}: {
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-head">{title}</div>
      {children}
      {footer ? <div className="panel-foot">{footer}</div> : null}
    </section>
  )
}

export function EntityTile({
  current,
  onClick,
  children,
}: {
  current?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className="entity-tile" aria-current={current || undefined} onClick={onClick}>
      {children}
    </button>
  )
}

export function LookupList({ items }: { items: ReactNode[] }) {
  return (
    <div className="lookup-list">
      {items.map((item, index) => (
        <div key={index} className="lookup-row">
          {item}
        </div>
      ))}
    </div>
  )
}

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `table-wrap ${className}` : 'table-wrap'}>{children}</div>
}

export function TablePager({
  page,
  pageCount,
  filteredCount,
  totalCount,
  onPageChange,
}: {
  page: number
  pageCount: number
  filteredCount: number
  totalCount: number
  onPageChange: (page: number) => void
}) {
  if (!(totalCount > 10 || pageCount > 1)) return null
  return (
    <div className="table-pager">
      <span>
        صفحة <span className="num font-semibold text-[var(--color-text)]">{page}</span> من{' '}
        <span className="num font-semibold text-[var(--color-text)]">{pageCount}</span>
        {' — '}
        <span className="num">{filteredCount}</span> من <span className="num">{totalCount}</span>
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          السابق
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          التالي
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function DataTable({
  query,
  onQueryChange,
  page,
  pageCount,
  filteredCount,
  totalCount,
  onPageChange,
  emptyTitle = 'مفيش نتائج',
  emptyHint = 'جرّب تشيل البحث أو غيّر الكلمة.',
  toolbar,
  children,
}: {
  query: string
  onQueryChange: (value: string) => void
  page: number
  pageCount: number
  filteredCount: number
  totalCount: number
  onPageChange: (page: number) => void
  emptyTitle?: string
  emptyHint?: string
  toolbar?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="data-table">
      <div className="table-toolbar">
        <div className="table-search">
          <Search size={16} strokeWidth={1.75} aria-hidden />
          <input
            className="input"
            placeholder="بحث…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="بحث في الجدول"
          />
        </div>
        {toolbar}
      </div>
      {filteredCount === 0 ? (
        <EmptyState title={emptyTitle} hint={emptyHint} onClear={query ? () => onQueryChange('') : undefined} />
      ) : (
        <TableWrap>
          {children}
          <TablePager
            page={page}
            pageCount={pageCount}
            filteredCount={filteredCount}
            totalCount={totalCount}
            onPageChange={onPageChange}
          />
        </TableWrap>
      )}
    </div>
  )
}

export function ListSearch({
  query,
  onQueryChange,
  children,
}: {
  query: string
  onQueryChange: (value: string) => void
  children?: ReactNode
}) {
  return (
    <div className="table-toolbar">
      <input
        className="input max-w-xs"
        placeholder="بحث…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="بحث"
      />
      {children}
    </div>
  )
}
