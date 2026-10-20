import {
  Banknote,
  BarChart3,
  Contact,
  LayoutDashboard,
  Receipt,
  Settings,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  anyOf: [string, string][]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'لوحة رئيسية', icon: LayoutDashboard, anyOf: [['dashboard', 'view']] },
  {
    to: '/purchases',
    label: 'الواردات',
    icon: Wallet,
    anyOf: [['purchases', 'view']],
  },
  {
    to: '/expenses',
    label: 'المصروفات العمومية',
    icon: Banknote,
    anyOf: [['expenses', 'view']],
  },
  { to: '/suppliers', label: 'الموردين', icon: Truck, anyOf: [['suppliers', 'view']] },
  { to: '/inventory', label: 'المخزون', icon: Warehouse, anyOf: [['inventory', 'view']] },
  { to: '/revenue', label: 'الصادرات', icon: Receipt, anyOf: [['sales', 'view']] },
  { to: '/customers', label: 'العملاء', icon: Contact, anyOf: [['customers', 'view']] },
  { to: '/reports', label: 'التقارير', icon: BarChart3, anyOf: [['reports', 'view']] },
  { to: '/users', label: 'المستخدمين', icon: Users, anyOf: [['users', 'view']] },
  { to: '/settings', label: 'الإعدادات', icon: Settings, anyOf: [['settings', 'view']] },
]
