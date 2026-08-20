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
    description: 'Planning phase / no strict deadline',
  },
  {
    value: 'soon',
    label: 'Standard',
    description: 'Delivery targeted within 2–3 weeks',
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
    clientName: !form.clientName.trim() ? 'Your full name is required' : undefined,
    company: !form.company.trim() ? 'Organization / Company name is required' : undefined,
    email: !form.email.trim()
      ? 'Work email is required'
      : !isEmailValid
      ? 'Please enter a valid email address (e.g. name@company.com)'
      : undefined,
    phone: !form.phone.trim()
      ? 'Phone number is required'
      : !isPhoneValid
      ? 'Please enter a valid phone number (at least 7 digits)'
      : undefined,
    subject: !form.subject.trim() ? 'A brief summary is required' : undefined,
    description: !form.description.trim() ? 'Please provide detailed requirements' : undefined,
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
    <div className="min-h-screen flex flex-col bg-[#f4f6f5] text-[#0b131b]">
      {/* ── Topbar ── */}
      <header className="h-14 border-b border-[#e2e8e5] bg-white px-6 sm:px-10 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[#0b131b] text-white flex items-center justify-center font-bold text-xs">
            N
          </div>
          <span className="font-bold text-[14px] tracking-tight text-[#0b131b]">Nvara Media</span>
          <span className="text-[12px] font-medium text-[#64748b] hidden sm:inline-block">/ Request Submission</span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#64748b] hover:text-[#0f172a] px-2.5 py-1 rounded border border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors cursor-pointer"
        >
          <span>←</span>
          <span>Portal Home</span>
        </button>
      </header>

      {/* ── Main Canvas (Purposeful 2-Column Desktop Grid) ── */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 sm:px-10 py-10 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 items-start">
          {/* ── Left Column: Clean Progressive Intake Form ── */}
          <div>
            <div className="mb-8">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#059669] mb-1">
                Client Intake
              </span>
              <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-[#0f172a] leading-tight mb-2">
                Submit Project Requirements
              </h1>
              <p className="text-[14px] text-[#64748b] leading-relaxed max-w-xl">
                Provide your scope details below. Our operations team will assign a dedicated specialist and confirm receipt within our 24-hour SLA standard.
              </p>
            </div>

            <form onSubmit={submit} noValidate aria-label="Client request submission form" className="space-y-8">
              {/* Section 1: Contact Information */}
              <section className="space-y-4">
                <div className="pb-2 border-b border-[#e2e8f0]">
                  <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#0f172a]">
                    1. Contact &amp; Organization
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </section>

              {/* Section 2: Requirement Scope */}
              <section className="space-y-4">
                <div className="pb-2 border-b border-[#e2e8f0]">
                  <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#0f172a]">
                    2. Requirement Scope
                  </h2>
                </div>

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
                  label="Requirement Summary"
                  required
                  value={form.subject}
                  error={fieldError('subject')}
                  placeholder="One sentence summary — e.g. Performance marketing campaign for Q4 product launch"
                  onChange={(val) => set('subject', val)}
                  onBlur={() => touch('subject')}
                />

                {/* Description */}
                <div>
                  <label htmlFor="f-desc" className="block text-[12px] font-semibold text-[#334155] mb-1.5">
                    Detailed Deliverables &amp; Context <span className="text-[#e11d48]">*</span>
                  </label>
                  <textarea
                    id="f-desc"
                    rows={5}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    onBlur={() => touch('description')}
                    placeholder="Provide details on project goals, key deliverables, constraints, and target outcomes..."
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
                              ? 'bg-white border-[#0f172a] shadow-xs'
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
              </section>

              {/* Form Validation Alert */}
              {submitAttempted && !allValid && (
                <div className="p-4 rounded-md bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239] text-[13px] font-medium">
                  Please complete all required fields marked with an asterisk before submitting.
                </div>
              )}

              {submitError && (
                <div className="p-4 rounded-md bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239] text-[13px] font-medium">
                  {submitError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2.5 rounded-md border border-[#cbd5e1] bg-white text-[13px] font-medium text-[#475569] hover:bg-[#f8fafc] transition-colors"
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
                    'Submit Request →'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── Right Column: Helpful Sticky Guide & Trust Context ── */}
          <aside className="sticky top-20 space-y-6">
            {/* What Happens Next Card */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-6 shadow-xs">
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#64748b] mb-4">
                Service Delivery Process
              </h2>
              <ol className="space-y-4 text-[13px] text-[#334155]">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#0f172a] text-white font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                    01
                  </span>
                  <div>
                    <strong className="block text-[#0f172a]">Requirement Intake</strong>
                    <span className="text-[12px] text-[#64748b] leading-tight">Your submission is cataloged and assigned a tracking reference.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#0f172a] text-white font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                    02
                  </span>
                  <div>
                    <strong className="block text-[#0f172a]">PM Review &amp; Assignment</strong>
                    <span className="text-[12px] text-[#64748b] leading-tight">A Project Manager routes the task to the appropriate specialist.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#0f172a] text-white font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                    03
                  </span>
                  <div>
                    <strong className="block text-[#0f172a]">24-Hour SLA Response</strong>
                    <span className="text-[12px] text-[#64748b] leading-tight">Specialist acknowledges receipt and begins active work.</span>
                  </div>
                </li>
              </ol>
            </div>

            {/* SLA Commitment Card */}
            <div className="bg-[#ecfdf5] rounded-lg border border-[#d1fae5] p-5">
              <div className="flex items-center gap-2 text-[#065f46] font-bold text-[13px] mb-1">
                <span className="w-2 h-2 rounded-full bg-[#059669]" />
                <span>24-Hour SLA Commitment</span>
              </div>
              <p className="text-[12px] text-[#065f46] leading-relaxed">
                All client requests receive dedicated specialist assignment and acknowledgement within 24 hours of submission.
              </p>
            </div>

            {/* Direct Contact Card */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 text-[12.5px] space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] block">
                Direct Contact
              </span>
              <p className="text-[#64748b]">
                Need immediate coordination? Contact our operations desk:
              </p>
              <div className="pt-1 flex flex-col gap-1 text-[#0f172a] font-medium font-mono text-[12px]">
                <a href="mailto:info@nvaramedia.com" className="hover:underline">info@nvaramedia.com</a>
                <span>+91 81266 61652</span>
              </div>
            </div>
          </aside>
        </div>
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
