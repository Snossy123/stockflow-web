import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { apiGet, apiPost, ApiError } from './api'
import type { Me } from './types'

type AuthContextValue = {
  me: Me | null
  loading: boolean
  error: string | null
  login: (username: string, password: string, rememberMe: boolean) => Promise<void>
  logout: () => Promise<void>
  can: (resource: string, action: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Me>('/auth/me')
      .then(setMe)
      .catch((err: unknown) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          setError(err instanceof Error ? err.message : 'تعذر الاتصال')
        }
        setMe(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      loading,
      error,
      async login(username, password, rememberMe) {
        const next = await apiPost<Me>('/auth/login', { username, password, rememberMe })
        setMe(next)
      },
      async logout() {
        await apiPost('/auth/logout')
        setMe(null)
      },
      can(resource, action) {
        return Boolean(me?.permissions.some((p) => p.resource === resource && p.action === action))
      },
    }),
    [me, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth')
  return ctx
}
