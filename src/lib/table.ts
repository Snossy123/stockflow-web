import { useMemo, useRef, useState } from 'react'

const PAGE_SIZE = 10

export function searchText(...parts: Array<string | number | null | undefined | boolean>) {
  return parts
    .filter((part) => part != null && part !== '')
    .map((part) => String(part))
    .join(' ')
}

export function useTableQuery<T>(rows: T[], getSearchText: (row: T) => string, pageSize = PAGE_SIZE) {
  const [query, setQueryState] = useState('')
  const [page, setPage] = useState(1)
  const getter = useRef(getSearchText)
  getter.current = getSearchText

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => getter.current(row).toLowerCase().includes(needle))
  }, [rows, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  function setQuery(value: string) {
    setQueryState(value)
    setPage(1)
  }

  return {
    query,
    setQuery,
    page: safePage,
    setPage,
    pageCount,
    pageRows,
    filteredCount: filtered.length,
    totalCount: rows.length,
  }
}
