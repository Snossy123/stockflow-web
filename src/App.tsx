import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuthProvider, useAuth } from './lib/auth'
import { CustomersPage } from './pages/CustomersPage'
import { DashboardPage } from './pages/DashboardPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { InventoryPage } from './pages/InventoryPage'
import { LoginPage } from './pages/LoginPage'
import { PurchasesPage } from './pages/PurchasesPage'
import { ReportsPage } from './pages/ReportsPage'
import { RevenuePage } from './pages/RevenuePage'
import { SettingsPage } from './pages/SettingsPage'
import { SuppliersPage } from './pages/SuppliersPage'
import { UsersPage } from './pages/UsersPage'

function Guard() {
  const { me, loading } = useAuth()
  if (loading) {
    return <main className="app-loading">جاري التحميل…</main>
  }
  if (!me) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

function Guest() {
  const { me, loading } = useAuth()
  if (loading) {
    return <main className="app-loading">جاري التحميل…</main>
  }
  if (me) {
    return <Navigate to="/" replace />
  }
  return <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Guest />} />
          <Route element={<Guard />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/revenue" element={<RevenuePage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
