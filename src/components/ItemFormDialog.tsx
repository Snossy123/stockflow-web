import { useEffect, useState } from 'react'
import { Dialog, Field } from './ui'
import { apiGet, apiPost } from '../lib/api'
import type { IdName, Item } from '../lib/types'

type ItemFormDialogProps = {
  onClose: () => void
  onCreated: (item: Item) => void
  onError: (message: string) => void
  showMinQty?: boolean
  showOpeningBalance?: boolean
}

export function ItemFormDialog({
  onClose,
  onCreated,
  onError,
  showMinQty = true,
  showOpeningBalance = true,
}: ItemFormDialogProps) {
  const [categories, setCategories] = useState<IdName[]>([])
  const [units, setUnits] = useState<IdName[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(0)
  const [unitId, setUnitId] = useState(0)
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [thickness, setThickness] = useState('')
  const [minQty, setMinQty] = useState('10')
  const [openingQty, setOpeningQty] = useState('')
  const [openingUnitCost, setOpeningUnitCost] = useState('0')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void apiGet<IdName[]>('/categories').then((rows) => {
      setCategories(rows)
      if (rows[0]) setCategoryId(rows[0].id)
    })
    void apiGet<IdName[]>('/units').then((rows) => {
      setUnits(rows)
      if (rows[0]) setUnitId(rows[0].id)
    })
  }, [])

  return (
    <Dialog title="صنف جديد" onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!code.trim() || !name.trim() || !categoryId || !unitId) return
          setSaving(true)
          const body: Record<string, unknown> = {
            code: code.trim(),
            name: name.trim(),
            categoryId,
            unitId,
            length: length.trim() || null,
            width: width.trim() || null,
            thickness: thickness.trim() || null,
          }
          if (showMinQty) body.minQty = Number(minQty || 0)
          if (showOpeningBalance) {
            const qty = Number(openingQty || 0)
            if (qty > 0) {
              body.openingQty = qty
              body.openingUnitCost = Number(openingUnitCost || 0)
            }
          }
          void apiPost<Item>('/items', body)
            .then((item) => {
              onCreated(item)
              onClose()
            })
            .catch((err: unknown) => onError(err instanceof Error ? err.message : 'فشل الحفظ'))
            .finally(() => setSaving(false))
        }}
      >
        <Field label="الكود">
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} required />
        </Field>
        <Field label="البيان">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="الطول">
            <input className="input" value={length} onChange={(e) => setLength(e.target.value)} placeholder="مثال: 3 م" />
          </Field>
          <Field label="العرض">
            <input className="input" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="مثال: 20 سم" />
          </Field>
          <Field label="التخانة">
            <input className="input" value={thickness} onChange={(e) => setThickness(e.target.value)} placeholder="مثال: 4 سم" />
          </Field>
        </div>
        <Field label="التصنيف">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} required>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الوحدة">
          <select className="input" value={unitId} onChange={(e) => setUnitId(Number(e.target.value))} required>
            {units.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        {showOpeningBalance ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رصيد افتتاحي">
              <input
                className="input num"
                value={openingQty}
                onChange={(e) => setOpeningQty(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="تكلفة الوحدة">
              <input
                className="input num"
                value={openingUnitCost}
                onChange={(e) => setOpeningUnitCost(e.target.value)}
              />
            </Field>
          </div>
        ) : null}
        {showMinQty ? (
          <Field label="حد التنبيه">
            <input className="input num" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </Field>
        ) : null}
        <button type="submit" className="btn btn-primary mt-2" disabled={saving}>
          إضافة صنف
        </button>
      </form>
    </Dialog>
  )
}

export function specText(value: string | null | undefined) {
  return value?.trim() ? value : '—'
}
