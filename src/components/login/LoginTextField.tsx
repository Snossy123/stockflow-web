import type { InputHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type LoginTextFieldProps = {
  id: string
  name: string
  label: string
  icon: LucideIcon
  trailing?: ReactNode
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'className'>

export function LoginTextField({
  id,
  name,
  label,
  icon: Icon,
  trailing,
  ...inputProps
}: LoginTextFieldProps) {
  return (
    <div className="login-field">
      <label htmlFor={id}>{label}</label>
      <div className="login-field-shell">
        <span className="login-field-icon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <input
          id={id}
          name={name}
          className={trailing ? 'login-input login-input-has-trailing' : 'login-input'}
          {...inputProps}
        />
        {trailing ? <div className="login-field-trailing">{trailing}</div> : null}
      </div>
    </div>
  )
}
