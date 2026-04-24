"use client"

import { useEffect, useRef, useState } from "react"
import { Toast } from "@/components/ui/toast"

type Variant = "pill" | "inline"

/**
 * Share affordance — clicking it copies the full shareable URL to the
 * clipboard and flashes a toast. Replaces the older "display the URL + a
 * separate Copy Link button" pattern, which was both redundant and showed a
 * made-up vanity host.
 *
 * `pill` variant is a small olive-tinted pill for placement under a title;
 * `inline` is a plain underline link for use inside existing button rows.
 */
export function ShareButton({
  id,
  variant = "pill",
  label = "Share quiz",
}: {
  id: string
  variant?: Variant
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  async function onClick() {
    if (typeof window === "undefined") return
    const url = `${window.location.origin}/quiz/${id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // best effort — if clipboard is blocked, still show the toast so the
      // user gets feedback that something happened
    }
    setCopied(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Copy shareable link"
        className={
          variant === "pill"
            ? "inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-[6px] border border-[var(--olive-tint-border)] bg-[var(--olive-tint)] text-[var(--olive-dark)] font-mono text-[11.5px] hover:bg-[#e0e6d1] transition-colors"
            : "inline-flex items-center gap-[6px] text-[13px] text-[var(--olive-dark)] hover:underline underline-offset-4"
        }
      >
        <LinkIcon />
        {label}
      </button>
      {copied && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <Toast>Link copied</Toast>
        </div>
      )}
    </>
  )
}

function LinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}
