import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { specText } from './ItemFormDialog'
import { Dialog, Money, TableWrap } from './ui'
import { apiGet } from '../lib/api'
import { dateText, money, qty, statusLabel } from '../lib/format'
import type { Purchase, Sale } from '../lib/types'

export type InvoiceViewTarget =
  | { kind: 'sale'; data: Sale }
  | { kind: 'purchase'; data: Purchase }
  | { kind: 'sale' | 'purchase'; id: number }

export function InvoiceRefButton({
  label,
  onClick,
  title = 'عرض تفاصيل الفاتورة',
}: {
  label: string
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost num font-semibold"
      title={title}
      onClick={onClick}
    >
      <FileText size={15} strokeWidth={1.75} aria-hidden />
      <span>{label}</span>
    </button>
  )
}

function InfoStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--color-bg)] border border-[var(--color-border)]">
      <div className="text-xs text-[var(--color-muted)] mb-1">{label}</div>
      <div className="font-bold text-sm text-[var(--color-text)]">{children}</div>
    </div>
  )
}

export function InvoiceDetailsDialog({
  target,
  onClose,
  onSelectTarget,
}: {
  target: InvoiceViewTarget | null
  onClose: () => void
  onSelectTarget?: (next: InvoiceViewTarget) => void
}) {
  const [sale, setSale] = useState<Sale | null>(null)
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!target) {
      setSale(null)
      setPurchase(null)
      setLoading(false)
      setError(null)
      return
    }
    setError(null)
    if ('data' in target) {
      if (target.kind === 'sale') {
        setSale(target.data)
        setPurchase(null)
      } else {
        setPurchase(target.data)
        setSale(null)
      }
      setLoading(false)
      return
    }
    setLoading(true)
    if (target.kind === 'sale') {
      setPurchase(null)
      void apiGet<Sale>(`/sales/${target.id}`)
        .then(setSale)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل الفاتورة'))
        .finally(() => setLoading(false))
    } else {
      setSale(null)
      void apiGet<Purchase>(`/purchases/${target.id}`)
        .then(setPurchase)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل الفاتورة'))
        .finally(() => setLoading(false))
    }
  }, [target])

  if (!target) return null

  const title = sale
    ? `${sale.kind === 'return' ? 'تفاصيل مرتجع بيع' : 'تفاصيل فاتورة بيع'} ${sale.no}`
    : purchase
      ? `${purchase.status === 'reversed' && purchase.reversedOfId ? 'تفاصيل قيد عكسي لشراء' : 'تفاصيل فاتورة شراء'} ${purchase.no}`
      : 'تفاصيل الفاتورة'

  return (
    <Dialog title={title} size="xl" onClose={onClose}>
      {loading ? (
        <div className="py-8 text-sm text-[var(--color-muted)]">جاري تحميل تفاصيل الفاتورة…</div>
      ) : error ? (
        <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--color-accent-100)] text-[var(--color-accent-700)] text-sm font-medium">
          {error}
        </div>
      ) : sale ? (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
            <InfoStat label="رقم الفاتورة">
              <span className="num">{sale.no}</span>
            </InfoStat>
            <InfoStat label="العميل">{sale.customerName}</InfoStat>
            <InfoStat label="النوع">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>{sale.kind === 'return' ? 'مرتجع بيع' : 'فاتورة بيع'}</span>
                {sale.reversedOfId && sale.reversedOfNo && onSelectTarget ? (
                  <button
                    type="button"
                    className="btn btn-ghost num text-xs"
                    onClick={() => onSelectTarget({ kind: 'sale', id: sale.reversedOfId! })}
                  >
                    ({sale.reversedOfNo})
                  </button>
                ) : sale.reversedOfNo ? (
                  <span className="num text-xs text-[var(--color-muted)]">({sale.reversedOfNo})</span>
                ) : null}
              </div>
            </InfoStat>
            <InfoStat label="تاريخ المستند">
              <span className="num">{dateText(sale.docDate)}</span>
            </InfoStat>
            <InfoStat label="تاريخ الترحيل / الحالة">
              <div className="flex items-center gap-2">
                <span className="num">{dateText(sale.postingDate)}</span>
                <span className={sale.status === 'approved' ? 'tag tag-ok' : 'tag'}>{statusLabel(sale.status)}</span>
              </div>
            </InfoStat>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
            <InfoStat label="إجمالي الفاتورة">
              <Money value={sale.total} />
            </InfoStat>
            <InfoStat label={sale.kind === 'return' ? 'المردود نقدًا' : 'المستلم الآن'}>
              <Money value={sale.paidNow} />
            </InfoStat>
            <InfoStat label="الباقي على العميل">
              <span className={sale.remaining > 0 ? 'text-[var(--color-accent-700)]' : ''}>
                <Money value={sale.remaining} />
              </span>
            </InfoStat>
            <InfoStat label="تكلفة المبيعات">
              <Money value={sale.cogs} />
            </InfoStat>
            <InfoStat label="صافي الربح">
              <Money value={sale.profit} />
            </InfoStat>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--color-muted)] mb-2">
              بنود الفاتورة (<span className="num">{sale.items.length}</span>)
            </div>
            <TableWrap>
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>الكود</th>
                    <th>الصنف</th>
                    <th>الوحدة</th>
                    <th>طول اللوح</th>
                    <th>المقطوع</th>
                    <th>العدد</th>
                    <th>سعر الوحدة</th>
                    <th>تكلفة الوحدة</th>
                    <th>الإجمالي</th>
                    <th>القص / الفائض</th>
                    {sale.status === 'approved' && sale.kind === 'sale' ? <th>متبقي للمرتجع</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((line) => (
                    <tr key={line.id}>
                      <td className="num">{line.itemCode}</td>
                      <td>{line.itemName}</td>
                      <td>{specText(line.unitName)}</td>
                      <td className="num">{line.boardLength != null ? qty(line.boardLength) : '—'}</td>
                      <td>{line.lengthDesc || (line.cutLength != null ? `${qty(line.cutLength)} م` : '—')}</td>
                      <td className="num font-semibold">{qty(line.qty)}</td>
                      <td className="num">{money(line.unitPrice)}</td>
                      <td className="num">{money(line.unitCost)}</td>
                      <td className="num font-bold">{money(line.total)}</td>
                      <td>
                        {line.surplusItem ? (
                          <span className="tag">بند فائض</span>
                        ) : line.cut ? (
                          <span className="tag tag-accent">
                            {line.cutQty && Number(line.cutQty) < Number(line.qty)
                              ? `مقصوص (${qty(line.cutQty)} من ${qty(line.qty)})`
                              : 'مقصوص'}
                            {line.surplusGenerated ? ' + ولد فائض' : ''}
                          </span>
                        ) : (
                          <span className="tag tag-ok">بدون قص</span>
                        )}
                      </td>
                      {sale.status === 'approved' && sale.kind === 'sale' ? (
                        <td className="num">{qty(line.returnableQty)}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          <div className="dialog-foot">
            <div className="text-sm text-[var(--color-muted)]">
              إجمالي البنود: <span className="num font-bold text-[var(--color-text)]">{money(sale.total)}</span>
            </div>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              إغلاق
            </button>
          </div>
        </div>
      ) : purchase ? (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <InfoStat label="رقم الفاتورة">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="num">{purchase.no}</span>
                {purchase.reversedOfId && purchase.reversedOfNo && onSelectTarget ? (
                  <button
                    type="button"
                    className="btn btn-ghost num text-xs"
                    onClick={() => onSelectTarget({ kind: 'purchase', id: purchase.reversedOfId! })}
                  >
                    (عكس {purchase.reversedOfNo})
                  </button>
                ) : purchase.reversedOfNo ? (
                  <span className="num text-xs text-[var(--color-muted)]">(عكس {purchase.reversedOfNo})</span>
                ) : null}
              </div>
            </InfoStat>
            <InfoStat label="المورد">{purchase.supplierName}</InfoStat>
            <InfoStat label="تاريخ المستند">
              <span className="num">{dateText(purchase.docDate)}</span>
            </InfoStat>
            <InfoStat label="تاريخ الترحيل / الحالة">
              <div className="flex items-center gap-2">
                <span className="num">{dateText(purchase.postingDate)}</span>
                <span className={purchase.status === 'approved' ? 'tag tag-ok' : 'tag'}>
                  {statusLabel(purchase.status)}
                </span>
              </div>
            </InfoStat>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoStat label="إجمالي الفاتورة">
              <Money value={purchase.total} />
            </InfoStat>
            <InfoStat label="المدفوع الآن">
              <Money value={purchase.paidNow} />
            </InfoStat>
            <InfoStat label="الباقي على الحساب">
              <span className={purchase.remaining > 0 ? 'text-[var(--color-accent-700)]' : ''}>
                <Money value={purchase.remaining} />
              </span>
            </InfoStat>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--color-muted)] mb-2">
              بنود الفاتورة (<span className="num">{purchase.items.length}</span>)
            </div>
            <TableWrap>
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>الكود</th>
                    <th>الصنف</th>
                    <th>التصنيف</th>
                    <th>الطول</th>
                    <th>العرض</th>
                    <th>التخانة</th>
                    <th>الوحدة</th>
                    <th>العدد</th>
                    <th>التكلفة/وحدة</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((line) => (
                    <tr key={line.id}>
                      <td className="num">{line.itemCode}</td>
                      <td>{line.itemName}</td>
                      <td>{specText(line.categoryName)}</td>
                      <td>{specText(line.length)}</td>
                      <td>{specText(line.width)}</td>
                      <td>{specText(line.thickness)}</td>
                      <td>{specText(line.unitName)}</td>
                      <td className="num font-semibold">{qty(line.qty)}</td>
                      <td className="num">{money(line.unitCost)}</td>
                      <td className="num font-bold">{money(line.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          <div className="dialog-foot">
            <div className="text-sm text-[var(--color-muted)]">
              إجمالي الفاتورة: <span className="num font-bold text-[var(--color-text)]">{money(purchase.total)}</span>
            </div>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              إغلاق
            </button>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
