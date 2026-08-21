import React from 'react'

export interface PasswordScore {
  score: number // 0 to 4
  label: 'Weak' | 'Fair' | 'Good' | 'Strong'
  color: string
  hasMinLength: boolean
  hasMixedCase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
}

export function evaluatePassword(password: string): PasswordScore {
  const hasMinLength = password.length >= 8
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecialChar = /[^a-zA-Z0-9]/.test(password)

  let score = 0
  if (hasMinLength) score++
  if (hasMixedCase) score++
  if (hasNumber) score++
  if (hasSpecialChar && password.length >= 10) score++

  const labels: Array<PasswordScore['label']> = ['Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']

  return {
    score,
    label: labels[score] || 'Weak',
    color: colors[score] || 'bg-rose-500',
    hasMinLength,
    hasMixedCase,
    hasNumber,
    hasSpecialChar,
  }
}

interface PasswordStrengthMeterProps {
  password: string
  showChecklist?: boolean
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  showChecklist = true,
}) => {
  if (!password) return null

  const { score, label, color, hasMinLength, hasMixedCase, hasNumber, hasSpecialChar } =
    evaluatePassword(password)

  return (
    <div className="mt-2 space-y-2 text-xs" role="region" aria-label="Password strength meter">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px] font-medium text-slate-400">
          <span>Password Strength</span>
          <span
            className={
              score <= 1
                ? 'text-rose-400 font-semibold'
                : score === 2
                ? 'text-amber-400 font-semibold'
                : 'text-emerald-400 font-semibold'
            }
          >
            {label}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 h-1.5">
          {[0, 1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-full rounded-full transition-all duration-300 ${
                step <= score - 1 ? color : 'bg-slate-700/60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Checklist */}
      {showChecklist && (
        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-400">
          <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : ''}`}>
            <span>{hasMinLength ? '✓' : '○'}</span>
            <span>8+ characters</span>
          </div>
          <div className={`flex items-center gap-1.5 ${hasMixedCase ? 'text-emerald-400' : ''}`}>
            <span>{hasMixedCase ? '✓' : '○'}</span>
            <span>Upper & lowercase</span>
          </div>
          <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : ''}`}>
            <span>{hasNumber ? '✓' : '○'}</span>
            <span>At least 1 number</span>
          </div>
          <div className={`flex items-center gap-1.5 ${hasSpecialChar ? 'text-emerald-400' : ''}`}>
            <span>{hasSpecialChar ? '✓' : '○'}</span>
            <span>Special character</span>
          </div>
        </div>
      )}
    </div>
  )
}
