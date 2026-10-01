import { LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { NAV_ITEMS } from '../lib/nav'
import { ArafaLogo } from './ArafaLogo'

export function AppLayout() {
  const { me, can, logout } = useAuth()
  const items = NAV_ITEMS.filter((item) => item.anyOf.some(([resource, action]) => can(resource, action)))

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <div className="brand-mark">
            <ArafaLogo size={48} />
          </div>
          <div className="min-w-0">
            <p className="brand-name">عرفة الحلواني لتجارة الأخشاب</p>
            <p className="brand-sub">إدارة المبيعات والمشتريات والمخزون</p>
          </div>
        </div>

        <nav className="app-nav" aria-label="القائمة الرئيسية">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
                <Icon size={18} strokeWidth={1.75} aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="app-sidebar-foot">
          <div className="user-card">
            <div className="user-avatar">{me?.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold leading-tight">{me?.name}</div>
              <div className="text-[12px] text-[var(--color-muted)]">{me?.roleName}</div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void logout()}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden />
            خروج
          </button>
        </div>
      </aside>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  )
}
