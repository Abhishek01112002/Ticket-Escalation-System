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
    description: 'Planning phase / no hard deadline',
  },
  {
    value: 'soon',
    label: 'Standard',
    description: 'Required within the next 2–3 weeks',
  },
  {
    value: 'time_sensitive',
    label: 'Urgent',
    description: 'Critical timeline or active deadline',
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
      ? 'Enter a valid email address (e.g. name@company.com)'
      : undefined,
    phone: !form.phone.trim()
      ? 'Phone number is required'
      : !isPhoneValid
      ? 'Enter a valid phone number (at least 7 digits)'
      : undefined,
    subject: !form.subject.trim() ? 'A concise summary is required' : undefined,
    description: !form.description.trim() ? 'Please provide requirement details' : undefined,
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
          : 'Unable to submit your request at this time. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-[#0f172a]">
      {/* ── Topbar ── */}
      <header className="h-14 border-b border-[#e2e8f0] bg-white px-6 sm:px-10 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[#0f172a] text-white flex items-center justify-center font-bold text-xs">
            N
          </div>
          <span className="font-bold text-[14px] tracking-tight">Nvara Media</span>
          <span className="text-[12px] font-medium text-[#64748b] hidden sm:inline-block">/ Request Submission</span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] font-medium text-[#64748b] hover:text-[#0f172a] transition-colors"
        >
          Return to Home
        </button>
      </header>

      {/* ── Main Container ── */}
      <main className="flex-1 max-w-[840px] w-full mx-auto px-5 sm:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[#0f172a] mb-1.5">
            Submit a Client Request
          </h1>
          <p className="text-[14px] text-[#64748b]">
            Please provide your project requirements. Our operations team will review and assign an internal specialist within 24 hours.
          </p>
        </div>

        <form onSubmit={submit} noValidate aria-label="Client request submission form" className="flex flex-col gap-6">
          {/* Section 1: Client Information */}
          <div className="bg-white rounded-lg border border-[#e2e8f0] p-6 shadow-xs">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#64748b] mb-5 pb-3 border-b border-[#f1f5f9]">
              1. Contact &amp; Organization
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <FormInput
                id="f-name"
                label="Your Full Name"
                required
                value={form.clientName}
                error={fieldError('clientName')}
                placeholder="e.g. Priya Shah"
                onChange={(val) => set('clientName', val)}
                onBlur={() => touch('clientName')}
              />
              <FormInput
                id="f-company"
                label="Company / Brand"
                required
                value={form.company}
                error={fieldError('company')}
                placeholder="e.g. Acme Brands"
                onChange={(val) => set('company', val)}
                onBlur={() => touch('company')}
              />
              <FormInput
                id="f-email"
                type="email"
                label="Work Email"
                required
                value={form.email}
                error={fieldError('email')}
                placeholder="name@company.com"
                onChange={(val) => set('email', val)}
                onBlur={() => touch('email')}
              />
              <FormInput
                id="f-phone"
                type="tel"
                label="Phone / WhatsApp"
                required
                value={form.phone}
                error={fieldError('phone')}
                placeholder="+91 98765 43210"
                hint="For direct project coordination"
                onChange={(val) => set('phone', val)}
                onBlur={() => touch('phone')}
              />
            </div>
          </div>

          {/* Section 2: Requirement Details */}
          <div className="bg-white rounded-lg border border-[#e2e8f0] p-6 shadow-xs">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#64748b] mb-5 pb-3 border-b border-[#f1f5f9]">
              2. Requirement &amp; Scope
            </h2>
            <div className="flex flex-col gap-5">
              {/* Service Domain Selection */}
              <div>
                <label htmlFor="f-domain" className="block text-[12px] font-semibold text-[#334155] mb-1.5">
                  Service Area
                </label>
                <select
                  id="f-domain"
                  value={form.serviceDomain}
                  onChange={(e) => set('serviceDomain', e.target.value as ServiceDomain)}
                  className="w-full h-10 px-3 rounded-md border border-[#cbd5e1] bg-white text-[13.5px] font-medium text-[#0f172a] focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a] outline-none transition-colors"
                >
                  {SERVICE_DOMAINS.map((domain) => (
                    <option key={domain} value={domain}>
                      {SERVICE_DOMAIN_LABELS[domain]}
                    </option>
                  ))}
                </select>
                <p className="text-[12px] text-[#64748b] mt-1.5">
                  {SERVICE_DOMAIN_DESCRIPTIONS[form.serviceDomain]}
                </p>
              </div>

              {/* Subject */}
              <FormInput
                id="f-subject"
                label="Brief Subject / Title"
                required
                value={form.subject}
                error={fieldError('subject')}
                placeholder="Briefly describe what you need — e.g. Paid social campaign for Q4 product launch"
                onChange={(val) => set('subject', val)}
                onBlur={() => touch('subject')}
              />

              {/* Description */}
              <div>
                <label htmlFor="f-desc" className="block text-[12px] font-semibold text-[#334155] mb-1.5">
                  Detailed Scope &amp; Deliverables <span className="text-[#e11d48]">*</span>
                </label>
                <textarea
                  id="f-desc"
                  rows={5}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  onBlur={() => touch('description')}
                  placeholder="Share as much detail as possible: objectives, timeline expectations, target audience, deliverables..."
                  className={`w-full p-3 rounded-md border text-[13.5px] text-[#0f172a] leading-relaxed outline-none transition-colors ${
                    fieldError('description')
                      ? 'border-[#e11d48] bg-[#fff1f2] focus:border-[#e11d48]'
                      : 'border-[#cbd5e1] bg-white focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]'
                  }`}
                />
                {fieldError('description') && (
                  <p className="text-[12px] font-medium text-[#e11d48] mt-1">
                    {fieldError('description')}
                  </p>
                )}
              </div>

              {/* Urgency Selection */}
              <div>
                <span className="block text-[12px] font-semibold text-[#334155] mb-2">
                  Timeline Urgency
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {URGENCY_OPTIONS.map((opt) => {
                    const active = form.clientUrgency === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('clientUrgency', opt.value)}
                        className={`text-left p-3.5 rounded-md border text-[13px] transition-all select-none ${
                          active
                            ? 'bg-[#f8fafc] border-[#0f172a] shadow-xs'
                            : 'bg-white border-[#e2e8f0] hover:border-[#cbd5e1]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold ${active ? 'text-[#0f172a]' : 'text-[#334155]'}`}>
                            {opt.label}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              active ? 'bg-[#0f172a]' : 'bg-[#cbd5e1]'
                            }`}
                          />
                        </div>
                        <p className="text-[11.5px] text-[#64748b] leading-tight">
                          {opt.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Submission Errors */}
          {submitAttempted && !allValid && (
            <div className="p-4 rounded-md bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239] text-[13px] font-medium flex items-center gap-2">
              <span>Please fill in all required fields before submitting.</span>
            </div>
          )}

          {submitError && (
            <div className="p-4 rounded-md bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239] text-[13px] font-medium">
              {submitError}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 rounded-md border border-[#e2e8f0] bg-white text-[13px] font-medium text-[#475569] hover:bg-[#f8fafc] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#0f172a] text-white text-[13.5px] font-semibold hover:bg-[#1e293b] disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin -ml-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                    <path d="M12 7a5 5 0 01-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit request'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

function FormInput({
  id,
  label,
  value,
  error,
  placeholder,
  required,
  type = 'text',
  hint,
  onChange,
  onBlur,
}: {
  id: string
  label: string
  value: string
  error?: string
  placeholder?: string
  required?: boolean
  type?: string
  hint?: string
  onChange: (val: string) => void
  onBlur?: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-semibold text-[#334155]">
        {label} {required && <span className="text-[#e11d48]">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full h-10 px-3 rounded-md border text-[13.5px] text-[#0f172a] outline-none transition-colors ${
          error
            ? 'border-[#e11d48] bg-[#fff1f2] focus:border-[#e11d48]'
            : 'border-[#cbd5e1] bg-white focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]'
        }`}
      />
      {hint && !error && <p className="text-[11px] text-[#94a3b8]">{hint}</p>}
      {error && <p className="text-[11.5px] font-medium text-[#e11d48]">{error}</p>}
    </div>
  )
}
