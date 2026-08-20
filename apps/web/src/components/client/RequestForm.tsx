import { type FormEvent, useState } from 'react'
import {
  SERVICE_DOMAIN_DESCRIPTIONS,
  SERVICE_DOMAIN_LABELS,
  type ClientUrgency,
  type CreateRequestInput,
  type ServiceDomain,
} from '../../domain/ticket'
import { ClientRequestApiError, type SubmissionConfirmation } from '../../services/clientRequestApi'

const SERVICE_DOMAINS = Object.keys(SERVICE_DOMAIN_LABELS) as ServiceDomain[]

const URGENCY_OPTIONS: {
  value: ClientUrgency
  label: string
  description: string
}[] = [
  {
    value: 'flexible',
    label: 'Flexible',
    description: 'No hard deadline — we can plan together',
  },
  {
    value: 'soon',
    label: 'Soon',
    description: 'We need progress within the next few weeks',
  },
  {
    value: 'time_sensitive',
    label: 'Time-sensitive',
    description: 'We have an urgent deadline or live issue',
  },
]

export function RequestForm({
  onSubmit,
  onBack,
}: {
  onSubmit(input: CreateRequestInput): Promise<SubmissionConfirmation>
  onBack(): void
}) {
  const [form, setForm] = useState<CreateRequestInput>({
    clientName: '',
    company: '',
    email: '',
    phone: '',
    serviceDomain: 'digital_marketing',
    subject: '',
    description: '',
    clientUrgency: 'flexible',
  })
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitError, setSubmitError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const isPhoneValid = /^[\d\s\+\-\(\)]{7,}$/.test(form.phone.trim())

  const errors: Partial<Record<keyof CreateRequestInput, string>> = {
    clientName: !form.clientName.trim() ? 'Your name is required' : undefined,
    company: !form.company.trim() ? 'Company name is required' : undefined,
    email: !form.email.trim()
      ? 'Email address is required'
      : !isEmailValid
      ? 'Enter a valid email — e.g. name@company.com'
      : undefined,
    phone: !form.phone.trim()
      ? 'Phone number is required'
      : !isPhoneValid
      ? 'Enter a valid phone number (at least 7 digits)'
      : undefined,
    subject: !form.subject.trim() ? 'A brief summary is required' : undefined,
    description: !form.description.trim() ? 'Please describe your requirement' : undefined,
  }

  const allValid = Object.values(errors).every((e) => !e)

  const fieldError = (field: keyof CreateRequestInput) =>
    submitAttempted || touched.has(field) ? errors[field] : undefined

  const touch = (field: string) =>
    setTouched((prev) => new Set([...prev, field]))

  const set = <K extends keyof CreateRequestInput>(key: K, value: CreateRequestInput[K]) =>
    setForm((c) => ({ ...c, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    setSubmitError(undefined)
    if (!allValid) return
    setSubmitting(true)
    try {
      await onSubmit(form)
    } catch (err) {
      setSubmitError(
        err instanceof ClientRequestApiError
          ? err.message
          : 'We could not submit your request. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface-2)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-5 sm:px-8"
        style={{
          height: 'var(--topbar-h)',
          background: 'var(--color-sidebar)',
          borderBottom: '1px solid var(--color-sidebar-border)',
        }}
      >
        <span
          className="w-7 h-7 rounded-md grid place-items-center font-bold text-sm flex-none"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-dark)',
            fontFamily: 'var(--font-display)',
          }}
        >
          N
        </span>
        <span className="text-white font-bold text-[14px] tracking-tight">Nvara Media</span>
        <button
          onClick={onBack}
          className="ml-auto text-[12.5px] font-semibold transition-colors"
          style={{ color: 'var(--color-ink-faint)' }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'white')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-ink-faint)')}
        >
          ← Back
        </button>
      </header>

      <main className="flex-1 w-full max-w-[960px] mx-auto px-5 sm:px-8 py-10">
        {/* Page heading */}
        <div className="mb-8">
          <p
            className="text-[10.5px] font-bold uppercase tracking-widest mb-2"
            style={{ color: 'var(--color-emerald-text)' }}
          >
            New Request
          </p>
          <h1
            className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight mb-2"
            style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
          >
            Submit a Request
          </h1>
          <p className="text-[13.5px] leading-relaxed max-w-lg" style={{ color: 'var(--color-ink-muted)' }}>
            Tell us what you need and our project team will review your request and get in touch shortly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
          {/* ── Form ── */}
          <form
            onSubmit={submit}
            noValidate
            aria-label="Service request form"
            className="flex flex-col gap-0"
          >
            {/* Section 1: Your details */}
            <FormSection title="Your Details" step="01">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Your Name"
                  required
                  error={fieldError('clientName')}
                  htmlFor="f-name"
                >
                  <input
                    id="f-name"
                    type="text"
                    autoComplete="name"
                    value={form.clientName}
                    onChange={(e) => set('clientName', e.target.value)}
                    onBlur={() => touch('clientName')}
                    placeholder="e.g. Priya Shah"
                    aria-required="true"
                    aria-invalid={!!fieldError('clientName')}
                    aria-describedby={fieldError('clientName') ? 'err-clientName' : undefined}
                    className={inputCls(!!fieldError('clientName'))}
                  />
                </Field>

                <Field
                  label="Company / Organisation"
                  required
                  error={fieldError('company')}
                  htmlFor="f-company"
                >
                  <input
                    id="f-company"
                    type="text"
                    autoComplete="organization"
                    value={form.company}
                    onChange={(e) => set('company', e.target.value)}
                    onBlur={() => touch('company')}
                    placeholder="e.g. Acme Brands"
                    aria-required="true"
                    aria-invalid={!!fieldError('company')}
                    aria-describedby={fieldError('company') ? 'err-company' : undefined}
                    className={inputCls(!!fieldError('company'))}
                  />
                </Field>

                <Field
                  label="Email Address"
                  required
                  error={fieldError('email')}
                  htmlFor="f-email"
                >
                  <input
                    id="f-email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    onBlur={() => touch('email')}
                    placeholder="you@company.com"
                    aria-required="true"
                    aria-invalid={!!fieldError('email')}
                    aria-describedby={fieldError('email') ? 'err-email' : undefined}
                    className={inputCls(!!fieldError('email'))}
                  />
                </Field>

                <Field
                  label="Phone / WhatsApp"
                  required
                  error={fieldError('phone')}
                  htmlFor="f-phone"
                  hint="We may contact you here to discuss your project"
                >
                  <input
                    id="f-phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    onBlur={() => touch('phone')}
                    placeholder="+91 98765 43210"
                    aria-required="true"
                    aria-invalid={!!fieldError('phone')}
                    aria-describedby={fieldError('phone') ? 'err-phone' : 'hint-phone'}
                    className={inputCls(!!fieldError('phone'))}
                  />
                </Field>
              </div>
            </FormSection>

            {/* Section 2: Your request */}
            <FormSection title="Your Request" step="02">
              <div className="flex flex-col gap-5">
                {/* Service domain */}
                <Field
                  label="Service area"
                  required={false}
                  htmlFor="f-service"
                  hint="Select the type of work you need help with"
                >
                  <select
                    id="f-service"
                    value={form.serviceDomain}
                    onChange={(e) => set('serviceDomain', e.target.value as ServiceDomain)}
                    className={inputCls(false)}
                  >
                    {SERVICE_DOMAINS.map((d) => (
                      <option key={d} value={d}>
                        {SERVICE_DOMAIN_LABELS[d]}
                      </option>
                    ))}
                  </select>
                  {form.serviceDomain && (
                    <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
                      {SERVICE_DOMAIN_DESCRIPTIONS[form.serviceDomain as ServiceDomain]}
                    </p>
                  )}
                </Field>

                {/* Subject */}
                <Field
                  label="Request summary"
                  required
                  error={fieldError('subject')}
                  htmlFor="f-subject"
                  hint="One sentence describing what you need"
                >
                  <input
                    id="f-subject"
                    type="text"
                    value={form.subject}
                    onChange={(e) => set('subject', e.target.value)}
                    onBlur={() => touch('subject')}
                    placeholder="Briefly describe what you need — e.g. Social media strategy for Q4 product launch"
                    aria-required="true"
                    aria-invalid={!!fieldError('subject')}
                    className={inputCls(!!fieldError('subject'))}
                  />
                </Field>

                {/* Description */}
                <Field
                  label="Full description"
                  required
                  error={fieldError('description')}
                  htmlFor="f-description"
                  hint="Include goals, constraints, timelines, and anything else that helps us understand the project"
                >
                  <textarea
                    id="f-description"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    onBlur={() => touch('description')}
                    placeholder="Share as much detail as possible: describe the problem you're solving, your target audience, key deliverables, and any deadlines…"
                    rows={5}
                    aria-required="true"
                    aria-invalid={!!fieldError('description')}
                    className={`${inputCls(!!fieldError('description'))} resize-y leading-relaxed`}
                  />
                </Field>

                {/* Urgency */}
                <fieldset>
                  <legend
                    className="text-[11px] font-bold uppercase tracking-wider mb-3"
                    style={{ color: 'var(--color-ink-secondary)' }}
                  >
                    How soon do you need this?
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {URGENCY_OPTIONS.map((opt) => {
                      const active = form.clientUrgency === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => set('clientUrgency', opt.value)}
                          className="text-left px-4 py-3.5 rounded-lg border text-sm transition-all duration-100 select-none"
                          style={{
                            background: active ? 'var(--color-emerald-bg)' : 'white',
                            border: active
                              ? '1px solid var(--color-emerald-dot)'
                              : '1px solid var(--color-border)',
                            color: active ? 'var(--color-emerald-text)' : 'var(--color-ink-secondary)',
                            boxShadow: active ? '0 0 0 2px rgba(16,185,129,.12)' : 'var(--shadow-xs)',
                          }}
                        >
                          <p className="font-bold text-[13px]">{opt.label}</p>
                          <p
                            className="text-[11.5px] mt-0.5 leading-snug"
                            style={{
                              color: active ? 'var(--color-emerald-text)' : 'var(--color-ink-muted)',
                            }}
                          >
                            {opt.description}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              </div>
            </FormSection>

            {/* Error states */}
            {submitAttempted && !allValid && (
              <div
                role="alert"
                className="flex gap-3 p-4 rounded-lg mb-4 mt-1"
                style={{
                  background: 'var(--color-rose-bg)',
                  border: '1px solid var(--color-rose-border)',
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] flex-none mt-0.5"
                  style={{ background: 'var(--color-rose-dot)', color: 'white' }}
                >
                  !
                </span>
                <div>
                  <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--color-rose-text)' }}>
                    Please fix the following before submitting:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {Object.entries(errors)
                      .filter(([, v]) => v)
                      .map(([, msg]) => (
                        <li key={msg} className="text-[12.5px]" style={{ color: 'var(--color-rose-text)' }}>
                          {msg}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}

            {submitError && (
              <div
                role="alert"
                className="flex gap-3 p-4 rounded-lg mb-4 mt-1"
                style={{
                  background: 'var(--color-rose-bg)',
                  border: '1px solid var(--color-rose-border)',
                }}
              >
                <p className="text-[13px]" style={{ color: 'var(--color-rose-text)' }}>
                  {submitError}
                </p>
              </div>
            )}

            {/* Submit */}
            <div
              className="flex items-center justify-between gap-4 pt-5"
              style={{ borderTop: '1px solid var(--color-border-subtle)' }}
            >
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
                style={{
                  background: 'white',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-ink-secondary)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-[13.5px] font-bold transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: submitting ? 'var(--color-accent-hover)' : 'var(--color-accent)',
                  border: '1px solid var(--color-accent-border)',
                  color: 'var(--color-accent-dark)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {submitting && (
                  <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                    <path d="M12 7a5 5 0 01-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {submitting ? 'Submitting…' : 'Submit request →'}
              </button>
            </div>
          </form>

          {/* ── Sidebar info ── */}
          <aside aria-label="Request information" className="flex flex-col gap-4">
            <div
              className="rounded-xl p-5"
              style={{
                background: 'var(--color-emerald-bg)',
                border: '1px solid var(--color-emerald-border)',
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: 'var(--color-emerald-text)' }}
              >
                What happens next?
              </p>
              <ol className="flex flex-col gap-3.5">
                {[
                  {
                    n: '1',
                    title: 'Request received',
                    desc: 'Your details are sent directly to our project team.',
                  },
                  {
                    n: '2',
                    title: 'Review & assignment',
                    desc: 'A PM reviews your request and assigns the right specialist.',
                  },
                  {
                    n: '3',
                    title: 'We get in touch',
                    desc: 'A team member contacts you to discuss the project.',
                  },
                ].map((step) => (
                  <li key={step.n} className="flex gap-3">
                    <span
                      className="w-5 h-5 rounded-full text-white text-[10px] font-bold grid place-items-center flex-none mt-0.5"
                      style={{ background: 'var(--color-emerald-dot)' }}
                    >
                      {step.n}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--color-ink)' }}>
                        {step.title}
                      </p>
                      <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
                        {step.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div
              className="rounded-xl p-5"
              style={{
                background: 'white',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: 'var(--color-ink-muted)' }}
              >
                Contact us directly
              </p>
              <div className="flex flex-col gap-1.5">
                <a
                  href="mailto:info@nvaramedia.com"
                  className="text-[12.5px] font-medium hover:underline"
                  style={{ color: 'var(--color-ink-secondary)' }}
                >
                  info@nvaramedia.com
                </a>
                <a
                  href="tel:+918126661652"
                  className="text-[12.5px] font-medium hover:underline"
                  style={{ color: 'var(--color-ink-secondary)' }}
                >
                  +91 81266 61652
                </a>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

function FormSection({
  title,
  step,
  children,
}: {
  title: string
  step: string
  children: React.ReactNode
}) {
  return (
    <section
      className="mb-5"
      style={{
        background: 'white',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div
        className="flex items-center gap-3 mb-5 pb-4"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <span
          className="w-6 h-6 rounded-full text-[11px] font-bold grid place-items-center flex-none"
          style={{
            background: 'var(--color-sidebar)',
            color: 'var(--color-accent)',
          }}
        >
          {step}
        </span>
        <h2
          className="text-[14px] font-bold tracking-tight"
          style={{ color: 'var(--color-ink)' }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  required,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  const errorId = htmlFor ? `err-${htmlFor.replace('f-', '')}` : undefined
  const hintId = hint && htmlFor ? `hint-${htmlFor.replace('f-', '')}` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11.5px] font-bold"
        style={{ color: 'var(--color-ink-secondary)' }}
      >
        {label}
        {required && (
          <span
            className="ml-1 font-bold"
            style={{ color: 'var(--color-rose-text)' }}
            aria-label="required"
          >
            *
          </span>
        )}
      </label>
      {hint && !error && (
        <p id={hintId} className="text-[11.5px]" style={{ color: 'var(--color-ink-muted)' }}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-[12px] font-semibold flex items-center gap-1"
          style={{ color: 'var(--color-rose-text)' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}

function inputCls(invalid: boolean): string {
  return [
    'w-full rounded-lg px-3.5 py-2.5 text-[13.5px] font-medium',
    'transition-all duration-100',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    invalid
      ? 'border border-[var(--color-rose-dot)] bg-[var(--color-rose-bg)] focus:ring-[var(--color-rose-dot)]'
      : 'border border-[var(--color-border)] bg-white hover:border-[var(--color-border-strong)] focus:ring-[var(--color-emerald-dot)] focus:border-[var(--color-emerald-dot)]',
    'text-[var(--color-ink)]',
  ].join(' ')
}
