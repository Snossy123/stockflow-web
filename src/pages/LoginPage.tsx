import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Globe, Headset, Lock, User } from 'lucide-react'
import { ArafaLogo } from '../components/ArafaLogo'
import { LoginTextField } from '../components/login/LoginTextField'
import { LoginVisualPanel } from '../components/login/LoginVisualPanel'
import { apiGet, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import './login.css'

const LICENSE_MESSAGE = 'النظام غير مفعّل على هذا الجهاز'

function loginError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'LICENSE') {
    return err.message || LICENSE_MESSAGE
  }
  if (err instanceof ApiError && err.status === 401) {
    return 'اسم المستخدم أو كلمة المرور غير صحيحة'
  }
  return 'تعذر الاتصال بالنظام'
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let cancelled = false
    void apiGet<{ enforced: boolean; valid: boolean; message?: string | null }>('/license/status')
      .then((status) => {
        if (!cancelled && status.enforced && !status.valid) {
          setError(status.message || LICENSE_MESSAGE)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="login-page" dir="ltr">
      <main className="login-form-panel" dir="rtl">
        <header className="login-form-header">
          <div className="login-brand">
            <div className="login-brand-mark">
              <ArafaLogo size={48} />
            </div>
            <div className="login-brand-copy">
              <p className="login-brand-name">عرفة الحلواني لتجارة الأخشاب</p>
              <p className="login-brand-sub">إدارة المبيعات والمشتريات والمخزون</p>
            </div>
          </div>
          <span className="login-lang" aria-label="اللغة: العربية">
            <Globe size={15} strokeWidth={1.75} aria-hidden="true" />
            العربية
          </span>
        </header>

        <div className="login-form-body">
          <form
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              setPending(true)
              setError(null)
              void login(
                String(form.get('username') || ''),
                String(form.get('password') || ''),
                form.get('remember') === 'on',
              )
                .then(() => navigate('/'))
                .catch((err: unknown) => setError(loginError(err)))
                .finally(() => setPending(false))
            }}
          >
            <p className="login-kicker">مرحباً بك</p>
            <h1 className="login-title">سجّل دخولك إلى حسابك</h1>
            <p className="login-lead">ادخل إلى نظام المحل لإدارة المبيعات والمشتريات والمخزون</p>

            <div className="login-fields">
              <LoginTextField
                id="username"
                name="username"
                label="اسم المستخدم"
                icon={User}
                autoComplete="username"
              />
              <LoginTextField
                id="password"
                name="password"
                label="كلمة المرور"
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    className="login-icon-btn"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              <label className="login-remember">
                <input type="checkbox" name="remember" defaultChecked />
                <span>تذكرني على هذا الجهاز</span>
              </label>
              {error ? (
                <p className="login-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="login-submit" disabled={pending}>
                {pending ? 'جارٍ تسجيل الدخول...' : 'دخول'}
                {pending ? null : <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />}
              </button>
            </div>
          </form>
        </div>

        <footer className="login-form-footer">
          <Headset size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>للدعم الفني يرجى التواصل مع المسؤول عن النظام</span>
        </footer>
      </main>

      <LoginVisualPanel />
    </div>
  )
}
