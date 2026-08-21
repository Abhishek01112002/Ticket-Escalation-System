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
      requirement: request.subject || request.description,
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
      // Fallback
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
      <div className="fixed bottom-5 right-5 z-50">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-xl border border-[#34d399] transition-transform hover:scale-105 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>WhatsApp Briefing Ready ({request.id})</span>
        </button>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-labelledby="whatsapp-dispatch-title"
      className="fixed bottom-5 right-5 z-50 w-full max-w-[420px] bg-white rounded-2xl shadow-2xl border border-[#cbd5e1] p-4 text-left animate-slide-up font-sans"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse" />
          <h3 id="whatsapp-dispatch-title" className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
            WhatsApp Task Dispatcher
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
            title="Minimize"
            aria-label="Minimize drawer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
            title="Dismiss"
            aria-label="Close drawer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Specialist & Ticket Info Card */}
      <div className="mt-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Avatar user={{ name: specialist.name }} size="sm" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-[#0f172a] block truncate">
                {specialist.name}
              </span>
              <span className="text-[11px] text-[#64748b] font-mono block truncate">
                {formatPhoneDisplay(phone)}
              </span>
            </div>
          </div>

          <span className="font-mono text-[11px] font-bold text-[#065f46] bg-[#ecfdf5] px-2 py-0.5 rounded border border-[#d1fae5] shrink-0 truncate max-w-[140px]" title={request.id}>
            {request.id}
          </span>
        </div>

        {!hasPhone && (
          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded border border-[#fde68a]">
            <span>Notice:</span>
            <span>No WhatsApp number registered for this member</span>
          </div>
        )}
      </div>

      {/* Custom Note input */}
      <div className="mt-2.5 space-y-1">
        <label htmlFor="pm-custom-note" className="block text-[11px] font-bold text-[#475569]">
          Custom PM Instruction (Optional):
        </label>
        <input
          id="pm-custom-note"
          type="text"
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder="e.g. Focus on video assets first, client needs this tomorrow."
          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#cbd5e1] focus:border-[#059669] focus:ring-1 focus:ring-[#059669] outline-none text-[#0f172a] placeholder-[#94a3b8] bg-[#ffffff]"
        />
      </div>

      {/* Live WhatsApp Markdown Message Preview Box */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10.5px] font-bold text-[#64748b] uppercase tracking-wider">
            Message Preview (WhatsApp Formatted):
          </span>
          <span className="text-[10px] text-[#94a3b8] font-medium">Universal Web Dispatch</span>
        </div>
        <div className="p-3 rounded-xl bg-[#0b131b] text-[#86efac] font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap border border-[#1e293b] shadow-inner custom-scrollbar">
          {formattedMessage}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3.5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleLaunch}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-sm transition-all cursor-pointer hover:shadow"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <span>Open WhatsApp Chat</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold transition-colors cursor-pointer"
          title="Copy message to clipboard"
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  )
}
