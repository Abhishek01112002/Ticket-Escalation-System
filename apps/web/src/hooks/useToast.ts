import { useCallback, useEffect, useRef, useState } from 'react'

export type Toast = {
  id: number
  text: string
  kind: 'success' | 'error'
} | null

/**
 * Hook to manage auto-dismissing toast notifications
 */
export function useToast(autoDismissMs = 4000) {
  const [toast, setToast] = useState<Toast>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const showToast = useCallback(
    (text: string, kind: 'success' | 'error' = 'success') => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setToast({ id: Date.now(), text, kind })
      timerRef.current = setTimeout(() => setToast(null), autoDismissMs)
    },
    [autoDismissMs],
  )

  const clearToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  return { toast, showToast, clearToast }
}
