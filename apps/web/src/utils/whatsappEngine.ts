import { SERVICE_DOMAIN_LABELS } from '../domain/ticket'
import { formatDateTime } from '../domain/sla'

export interface TaskBriefingInput {
  reference: string
  clientName?: string | null
  clientCompany: string
  serviceDomain: string
  urgency: string
  requirement: string
  deadlineAt?: string | null
  customNote?: string
}

/**
 * Sanitizes phone numbers by stripping spaces, dashes, parentheses, plus signs.
 * Leaves clean digits suitable for WhatsApp universal links (e.g. 919876543210).
 */
export function sanitizeWhatsAppPhone(phone?: string | null): string {
  if (!phone) return ''
  return phone.replace(/[^\d]/g, '')
}

/**
 * Formats a phone number cleanly for UI badge display.
 */
export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone || !phone.trim()) return 'No phone registered'
  const clean = phone.trim()
  return clean.startsWith('+') ? clean : `+${clean}`
}

/**
 * Generates a high-clarity WhatsApp Markdown task briefing.
 */
export function generateWhatsAppTaskMessage(input: TaskBriefingInput): string {
  const domainLabel = SERVICE_DOMAIN_LABELS[input.serviceDomain as keyof typeof SERVICE_DOMAIN_LABELS] || input.serviceDomain
  const urgencyLabel = (input.urgency || 'standard').replace(/_/g, ' ').toUpperCase()
  const deadlineText = input.deadlineAt ? formatDateTime(input.deadlineAt) : 'Within 24 Hours'
  const trimmedRequirement = input.requirement.length > 280
    ? `${input.requirement.slice(0, 277)}...`
    : input.requirement

  let msg = `*NVARA MEDIA — TASK ALLOCATION*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `*Ticket Reference:* \`${input.reference}\`\n`
  msg += `*Client:* ${input.clientCompany}${input.clientName ? ` (${input.clientName})` : ''}\n`
  msg += `*Service Area:* ${domainLabel}\n`
  msg += `*Urgency:* ${urgencyLabel}\n`
  msg += `*SLA Window:* 24h Acknowledgement\n`
  msg += `*Deadline:* ${deadlineText}\n\n`
  msg += `*Scope Summary:*\n`
  msg += `"${trimmedRequirement}"\n`

  if (input.customNote && input.customNote.trim()) {
    msg += `\n*PM Instructions:*\n"${input.customNote.trim()}"\n`
  }

  msg += `\n*Operations Workspace:*\nhttp://127.0.0.1:5173\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━━`

  return msg
}

/**
 * Builds the standard WhatsApp universal deep link.
 */
export function getWhatsAppDeepLink(phone: string, message: string): string {
  const cleanPhone = sanitizeWhatsAppPhone(phone)
  const encodedText = encodeURIComponent(message)
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`
}
