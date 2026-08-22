import React, { useState, useEffect, useMemo } from 'react'
import type { Request } from '../../domain/ticket'
import {
  generateWhatsAppTaskMessage,
  getWhatsAppDeepLink,
  formatPhoneDisplay,
  sanitizeWhatsAppPhone,
} from '../../utils/whatsappEngine'
import { Avatar } from '../ui/layout'

export interface WhatsAppDispatchPayload {
  request: Request
  specialist: {
    id: string
    name: string
    email?: string
    phoneWhatsapp?: string | null
  }
}

export function WhatsAppDispatchDrawer({
  payload,
  onClose,
}: {
  payload: WhatsAppDispatchPayload
  onClose: () => void
}) {
  const [customNote, setCustomNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  const { request, specialist } = payload
  const phone = specialist.phoneWhatsapp || ''
  const hasPhone = Boolean(sanitizeWhatsAppPhone(phone))

  // Dynamically generate formatted briefing whenever customNote changes
  const formattedMessage = useMemo(() => {
    return generateWhatsAppTaskMessage({
      reference: request.id,
      clientName: request.client?.name,
      clientCompany: request.client?.company || 'Client Organization',
      serviceDomain: request.serviceDomain,
      urgency: request.clientUrgency,
      requirement: (request as any).requirement || request.subject || request.description || '',
      deadlineAt: request.assignment?.acknowledgementDeadline || request.sla?.deadlineAt,
      customNote,
    })
  }, [request, customNote])

  const deepLink = useMemo(() => {
    return getWhatsAppDeepLink(phone, formattedMessage)
  }, [phone, formattedMessage])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard fallback
    }
  }

  const handleLaunch = () => {
    window.open(deepLink, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold shadow-xl border border-[#334155] transition-all cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#34d399]">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Task Briefing ({request.id})</span>
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
        </button>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-labelledby="whatsapp-dispatch-title"
      className="fixed bottom-6 right-6 z-50 w-[calc(100vw-2rem)] sm:w-[460px] bg-white rounded-xl shadow-2xl border border-[#cbd5e1] text-left animate-slide-up font-sans overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#f8fafc] border-b border-[#e2e8f0]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#059669] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h3 id="whatsapp-dispatch-title" className="text-xs font-bold text-[#0f172a] tracking-tight">
              Task Dispatch Briefing
            </h3>
            <p className="text-[10.5px] text-[#64748b]">WhatsApp Notification Channel</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0] transition-colors cursor-pointer"
            title="Minimize"
            aria-label="Minimize drawer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0] transition-colors cursor-pointer"
            title="Close"
            aria-label="Close drawer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Recipient & Reference Meta Card */}
        <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar user={{ name: specialist.name }} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#0f172a] truncate">
                    {specialist.name}
                  </span>
                  <span className="text-[9.5px] font-semibold text-[#475569] bg-[#e2e8f0] px-1.5 py-0.2 rounded">
                    Specialist
                  </span>
                </div>
                <span className="text-[11px] text-[#64748b] font-mono block">
                  {formatPhoneDisplay(phone)}
                </span>
              </div>
            </div>

            <span className="font-mono text-[10.5px] font-bold text-[#0f172a] bg-white px-2 py-0.5 rounded border border-[#cbd5e1] shrink-0" title={request.id}>
              {request.id}
            </span>
          </div>

          {!hasPhone && (
            <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#b45309] bg-[#fef3c7] px-2.5 py-1 rounded border border-[#fde68a]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>No direct phone on profile. Link will open WhatsApp without pre-selected contact.</span>
            </div>
          )}
        </div>

        {/* Custom Instruction Input */}
        <div>
          <label htmlFor="pm-custom-note" className="block text-[11px] font-semibold text-[#334155] mb-1">
            Custom PM Instructions (Optional)
          </label>
          <input
            id="pm-custom-note"
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="e.g. Prioritize high-resolution asset export; client review scheduled for 4 PM."
            className="w-full text-xs px-3 py-2 rounded-lg border border-[#cbd5e1] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none text-[#0f172a] placeholder-[#94a3b8] bg-white transition-colors"
          />
        </div>

        {/* Formatted Message Preview */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10.5px] font-bold text-[#64748b] uppercase tracking-wider">
              Message Payload Preview
            </span>
            <span className="text-[10px] text-[#64748b] font-medium bg-[#f1f5f9] px-1.5 py-0.5 rounded">
              WhatsApp Markdown
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#0f172a] text-[#f1f5f9] font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap border border-[#1e293b] shadow-inner custom-scrollbar select-text">
            {formattedMessage}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={handleLaunch}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer hover:shadow"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span>Open in WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold transition-colors cursor-pointer shrink-0"
            title="Copy message to clipboard"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[#059669]">Copied</span>
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
