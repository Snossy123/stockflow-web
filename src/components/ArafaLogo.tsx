type ArafaLogoProps = {
  className?: string
  size?: number
}

export function ArafaLogo({ className, size = 48 }: ArafaLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="عرفة الحلواني لتجارة الأخشاب"
      width={size}
      height={size}
      className={`object-contain shrink-0 ${className ?? ''}`}
    />
  )
}
