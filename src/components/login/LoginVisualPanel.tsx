import { BarChart3, Package, Users, Wallet } from 'lucide-react'

const features = [
  {
    icon: BarChart3,
    title: 'تقارير واضحة',
    text: 'مبيعات ومشتريات وحركة المخزون',
  },
  {
    icon: Package,
    title: 'إدارة المخزون',
    text: 'متابعة الأصناف والكميات بدقة',
  },
  {
    icon: Wallet,
    title: 'الواردات والصادرات',
    text: 'سجل كل حركة مالية بسهولة',
  },
  {
    icon: Users,
    title: 'مستخدمين متعددين',
    text: 'صلاحيات مختلفة لكل مستخدم',
  },
]

export function LoginVisualPanel() {
  return (
    <aside className="login-visual-panel" dir="rtl">
      <img
        className="login-visual-image"
        src="/login_bg.jpeg"
        alt="مخزن أخشاب عرفة الحلواني"
      />
      <div className="login-visual-overlay" aria-hidden="true" />
      <div className="login-visual-content">
        <h2 className="login-visual-title">سيستم المحل</h2>
        <p className="login-visual-sub">واردات وصادرات ومخزون في مكان واحد</p>
        <p className="login-visual-lead login-desktop-hero-copy">كل ما تحتاجه لإدارة محلك بسهولة ودقة</p>
        <ul className="login-feature-grid">
          {features.map((feature) => (
            <li key={feature.title} className="login-feature-card">
              <span className="login-feature-icon" aria-hidden="true">
                <feature.icon size={18} strokeWidth={1.75} />
              </span>
              <h3 className="login-feature-title">{feature.title}</h3>
              <p className="login-feature-text">{feature.text}</p>
            </li>
          ))}
        </ul>
        <div className="login-visual-status">
          <span className="login-status-dot" aria-hidden="true" />
          <span>
            الإصدار <span className="num">1.0</span>
          </span>
        </div>
      </div>
    </aside>
  )
}
