import { useEffect, useState } from 'react'
import { apiGet } from './api'
import { useAuth } from './auth'
import { yearMonthKey } from './format'
import type { AccountingPeriod } from './types'

export function usePeriods() {
  const { can } = useAuth()
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])

  function reload() {
    if (!can('periods', 'view')) {
      setPeriods([])
      return
    }
    void apiGet<AccountingPeriod[]>('/periods').then(setPeriods)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function isClosed(value?: string | Date | null) {
    const key = yearMonthKey(value)
    return periods.some((row) => row.yearMonth === key && row.status === 'closed')
  }

  return {
    periods,
    reload,
    isClosed,
    currentMonthClosed: isClosed(new Date()),
  }
}
