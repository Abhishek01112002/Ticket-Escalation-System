/**
 * CommentsThread — Internal PM/Specialist Activity Notes
 *
 * A Slack-inspired real-time comment thread embedded inside the ticket detail
 * view. Strictly internal: never surfaced to clients or the public tracker.
 *
 * Features:
 *  - Optimistic UI: comment appears immediately, rolls back with toast on error
 *  - Cmd/Ctrl+Enter keyboard shortcut to submit
 *  - Character counter (0/4000) with colour shift near limit
 *  - Author role indicator (PM vs Specialist badge)
 *  - Relative timestamps (e.g., "2 minutes ago") with absolute ISO tooltip
 *  - Sticky empty state with contextual prompt
 *  - Auto-scroll to latest comment on load and on new post
 */

import { useEffect, useRef, useState } from 'react'
import type { RequestComment } from '../../domain/ticket'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const secs  = Math.floor(diff / 1000)
  if (secs < 60)  return 'just now'
  const mins  = Math.floor(secs / 60)
  if (mins < 60)  return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days  = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatAbsolute(isoString: string): string {
  return new Date(isoString).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function getRoleLabel(role: string): string {
  return role === 'project_manager' ? 'PM' : 'Specialist'
}

function getRoleColor(role: string): { bg: string; text: string; border: string } {
  return role === 'project_manager'
    ? { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' }
    : { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' }
}

function getAvatarColor(role: string): string {
  return role === 'project_manager' ? '#4338ca' : '#059669'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommentsThread({
  ticketReference,
  currentUserId,
  initialComments = [],
  onPost,
  onLoadMore,
}: {
  ticketReference: string
  currentUserId: string
  initialComments?: RequestComment[]
  onPost: (reference: string, body: string) => Promise<RequestComment>
  /** Optional: pull fresh comments from the server. Called on mount. */
  onLoadMore?: (reference: string) => Promise<RequestComment[]>
}) {
  const [comments, setComments]   = useState<RequestComment[]>(initialComments)
  const [draft, setDraft]         = useState('')
  const [busy, setBusy]           = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [postError, setPostError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const charCount = draft.length
  const maxChars  = 4000
  const canPost   = charCount >= 1 && charCount <= maxChars && !busy

  // Load fresh comments on mount
  useEffect(() => {
    if (!onLoadMore) return
    onLoadMore(ticketReference).then(setComments).catch(err => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load comments.')
    })
  }, [ticketReference]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  // Cmd/Ctrl+Enter to submit
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canPost) {
        e.preventDefault()
        handlePost()
      }
    }
    textarea.addEventListener('keydown', handler)
    return () => textarea.removeEventListener('keydown', handler)
  }, [canPost, draft]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePost = async () => {
    const trimmed = draft.trim()
    if (!trimmed || busy) return

    // Build optimistic comment
    const optimistic: RequestComment = {
      id:        `optimistic-${Date.now()}`,
      body:      trimmed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id:       currentUserId,
        name:     'You',
        role:     'project_manager', // will be replaced by server response
        initials: 'YO',
      },
    }

    setComments(prev => [...prev, optimistic])
    setDraft('')
    setPostError(null)
    setBusy(true)

    try {
      const confirmed = await onPost(ticketReference, trimmed)
      // Replace optimistic entry with real server response
      setComments(prev => prev.map(c => c.id === optimistic.id ? confirmed : c))
    } catch (err) {
      // Rollback optimistic comment and restore draft
      setComments(prev => prev.filter(c => c.id !== optimistic.id))
      setDraft(trimmed)
      setPostError(err instanceof Error ? err.message : 'Failed to post comment. Try again.')
    } finally {
      setBusy(false)
      textareaRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {/* ── Section Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#64748b]">
            Internal Notes
          </h2>
          <span
            className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]"
            title="Visible only to PM and the assigned Specialist"
          >
            🔒 Internal Only
          </span>
          {comments.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
              {comments.length}
            </span>
          )}
        </div>
      </div>

      {/* ── Error Loading ────────────────────────────────────────────────────── */}
      {loadError && (
        <div className="mb-4 p-3 rounded-lg bg-[#fff1f2] border border-[#ffe4e6] text-[12.5px] text-[#9f1239] font-medium">
          ⚠ {loadError}
        </div>
      )}

      {/* ── Comment Feed ─────────────────────────────────────────────────────── */}
      {comments.length === 0 && !loadError ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center text-[18px]">
            💬
          </div>
          <p className="text-[13px] font-semibold text-[#64748b]">No internal notes yet</p>
          <p className="text-[12px] text-[#94a3b8] max-w-[260px] leading-relaxed">
            Use this thread to share context, blockers, or coordination notes with the team.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-4 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
          {comments.map(comment => {
            const isOwn = comment.author.id === currentUserId
            const roleColor = getRoleColor(comment.author.role)
            const avatarColor = getAvatarColor(comment.author.role)
            const isOptimistic = comment.id.startsWith('optimistic-')

            return (
              <div
                key={comment.id}
                className={`flex gap-3 group transition-opacity ${isOptimistic ? 'opacity-60' : 'opacity-100'}`}
              >
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-none mt-0.5 shadow-xs select-none"
                  style={{ background: avatarColor }}
                  title={comment.author.name}
                >
                  {comment.author.initials}
                </div>

                {/* Bubble */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[13px] font-bold text-[#0f172a]">
                      {isOwn ? 'You' : comment.author.name}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                      style={{ background: roleColor.bg, color: roleColor.text, borderColor: roleColor.border }}
                    >
                      {getRoleLabel(comment.author.role)}
                    </span>
                    <time
                      className="text-[11.5px] text-[#94a3b8] cursor-default"
                      dateTime={comment.createdAt}
                      title={formatAbsolute(comment.createdAt)}
                    >
                      {isOptimistic ? 'Sending…' : relativeTime(comment.createdAt)}
                    </time>
                  </div>
                  <div
                    className={`text-[13.5px] text-[#334155] leading-relaxed whitespace-pre-wrap rounded-xl px-4 py-3 border ${
                      isOwn
                        ? 'bg-[#f0fdf4] border-[#dcfce7]'
                        : 'bg-[#f8fafc] border-[#f1f5f9]'
                    }`}
                  >
                    {comment.body}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Post Error ───────────────────────────────────────────────────────── */}
      {postError && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[#fff1f2] border border-[#ffe4e6] text-[12px] text-[#9f1239] font-medium">
          ⚠ {postError}
        </div>
      )}

      {/* ── Compose Box ──────────────────────────────────────────────────────── */}
      <div
        className={`rounded-xl border transition-colors ${
          busy ? 'border-[#e2e8f0]' : 'border-[#cbd5e1] focus-within:border-[#6366f1] focus-within:ring-2 focus-within:ring-[#6366f1]/10'
        } bg-white shadow-xs`}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={busy}
          placeholder="Add an internal note… (Ctrl+Enter to post)"
          rows={3}
          maxLength={maxChars + 1}
          className="w-full px-4 pt-3 pb-2 text-[13.5px] text-[#0f172a] placeholder-[#94a3b8] bg-transparent border-none outline-none resize-none leading-relaxed rounded-xl"
          aria-label="Internal note"
        />
        <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-[#f1f5f9]">
          <span
            className={`text-[11.5px] font-medium tabular-nums ${
              charCount > maxChars * 0.9
                ? charCount >= maxChars
                  ? 'text-[#e11d48]'
                  : 'text-[#d97706]'
                : 'text-[#94a3b8]'
            }`}
          >
            {charCount}/{maxChars}
          </span>
          <button
            type="button"
            onClick={handlePost}
            disabled={!canPost}
            className="h-8 px-4 rounded-lg text-[12.5px] font-bold text-white bg-[#4f46e5] hover:bg-[#4338ca] active:bg-[#3730a3] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer select-none flex items-center gap-2"
          >
            {busy ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Posting…
              </>
            ) : (
              <>
                <span>Post Note</span>
                <kbd className="text-[10px] opacity-60 font-mono">⌘↵</kbd>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
