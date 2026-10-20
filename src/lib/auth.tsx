import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { apiGet, apiPost, ApiError, setOnUnauthorized } from './api'
import type { Me } from './types'

type AuthContextValue = {
  me: Me | null
  loading: boolean
  error: string | null
  login: (username: string, password: string, rememberMe: boolean) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  can: (resource: string, action: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout')
    } catch {
      // Ignore if session is already expired
    } finally {
      setMe(null)
    }
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      const next = await apiGet<Me>('/auth/me')
      setMe(next)
    } catch (err: unknown) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setError(err instanceof Error ? err.message : 'تعذر الاتصال')
      }
      setMe(null)
    }
  }, [])

  useEffect(() => {
    setOnUnauthorized(() => {
      setMe(null)
    })
    return () => setOnUnauthorized(null)
  }, [])

  useEffect(() => {
    refreshMe().finally(() => setLoading(false))
  }, [refreshMe])

  useEffect(() => {
    if (!me) return
    const timeoutMinutes = Math.max(1, Number(me.sessionTimeoutMinutes || 30))
    const timeoutMs = timeoutMinutes * 60 * 1000
    let timerId = window.setTimeout(() => {
      void logout()
    }, timeoutMs)

    const resetTimer = () => {
      window.clearTimeout(timerId)
      timerId = window.setTimeout(() => {
        void logout()
      }, timeoutMs)
    }

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'touchstart']
    for (const evt of events) {
      window.addEventListener(evt, resetTimer, { passive: true })
    }

    return () => {
      window.clearTimeout(timerId)
      for (const evt of events) {
        window.removeEventListener(evt, resetTimer)
      }
    }
  }, [me, logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      loading,
      error,
      async login(username, password, rememberMe) {
        const next = await apiPost<Me>('/auth/login', { username, password, rememberMe })
        setMe(next)
      },
      logout,
      refreshMe,
      can(resource, action) {
        return Boolean(me?.permissions.some((p) => p.resource === resource && p.action === action))
      },
    }),
    [me, loading, error, logout, refreshMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth')
  return ctx
}
