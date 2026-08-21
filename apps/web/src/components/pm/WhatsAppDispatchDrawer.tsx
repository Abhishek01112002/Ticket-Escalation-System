import React, { useState, useEffect, useMemo } from 'react'
import type { Request, User } from '../../domain/ticket'
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
      <div className="fixed bottom-5 right-5 z-50 animate-bounce-short">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-xl border border-[#34d399] transition-transform hover:scale-105 cursor-pointer"
        >
          <span>💬</span>
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
            className="p-1 rounded text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] text-xs transition-colors cursor-pointer"
            title="Minimize"
          >
            🗕
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] text-xs font-bold transition-colors cursor-pointer"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Specialist & Ticket Pill */}
      <div className="mt-3 p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar user={{ name: specialist.name }} size="sm" />
          <div className="min-w-0">
            <span className="text-xs font-bold text-[#0f172a] block truncate">
              {specialist.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-[#64748b] font-mono">
                {formatPhoneDisplay(phone)}
              </span>
              {!hasPhone && (
                <span className="text-[9.5px] font-bold text-[#b45309] bg-[#fef3c7] px-1.5 py-0.2 rounded border border-[#fde68a]">
                  No WhatsApp Phone
                </span>
              )}
            </div>
          </div>
        </div>

        <span className="font-mono text-[11px] font-bold text-[#065f46] bg-[#ecfdf5] px-2 py-0.5 rounded border border-[#d1fae5] shrink-0">
          {request.id}
        </span>
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
          <span className="text-[10px] text-[#94a3b8]">0 Cost · wa.me</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0b131b] text-[#86efac] font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap border border-[#1e293b] shadow-inner custom-scrollbar">
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
          <span>🟢</span>
          <span>Open WhatsApp Chat</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold transition-colors cursor-pointer"
          title="Copy message to clipboard"
        >
          <span>{copied ? '✓' : '📋'}</span>
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  )
}
