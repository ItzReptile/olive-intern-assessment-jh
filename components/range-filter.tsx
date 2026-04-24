"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MicroLabel } from "@/components/ui/typography"
export type { RangeWindow } from "@/lib/range"

type Preset = "7d" | "30d" | "all" | "custom"

const PRESET_LABELS: Record<Preset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
  custom: "Custom range",
}

export function RangeFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)

  const current = (search.get("range") as Preset | null) ?? "30d"
  const from = search.get("from") ?? ""
  const to = search.get("to") ?? ""

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  function applyPreset(next: Preset) {
    if (next === "custom") {
      setCustomOpen(true)
      setOpen(false)
      return
    }
    const params = new URLSearchParams(search.toString())
    if (next === "30d") {
      params.delete("range")
    } else {
      params.set("range", next)
    }
    params.delete("from")
    params.delete("to")
    router.push(`${pathname}${params.toString() ? "?" + params.toString() : ""}`)
    setOpen(false)
  }

  function applyCustom(from: string, to: string) {
    const params = new URLSearchParams(search.toString())
    params.set("range", "custom")
    params.set("from", from)
    params.set("to", to)
    router.push(`${pathname}?${params.toString()}`)
    setCustomOpen(false)
  }

  const display =
    current === "custom" && from && to
      ? `${from} → ${to}`
      : PRESET_LABELS[current] ?? PRESET_LABELS["30d"]

  return (
    <>
      <div className="relative" ref={wrapperRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-[6px] font-mono text-[11px] text-[var(--muted-fg)] hover:text-[var(--foreground)] transition-colors"
        >
          <span>Range:</span>
          <span className="text-[var(--foreground)]">{display}</span>
          <span className="text-[var(--faint)]">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="absolute top-full right-0 mt-2 min-w-[200px] bg-[var(--surface)] border border-[var(--border)] rounded-[8px] shadow-card-hover z-20 overflow-hidden">
            {(["7d", "30d", "all", "custom"] as Preset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "block w-full text-left px-[14px] py-[9px] text-[13px] transition-colors",
                  current === p
                    ? "bg-[var(--olive-tint)] text-[var(--olive-dark)]"
                    : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                )}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      <CustomRangeModal
        open={customOpen}
        onOpenChange={setCustomOpen}
        initialFrom={from}
        initialTo={to}
        onApply={applyCustom}
      />
    </>
  )
}

function CustomRangeModal({
  open,
  onOpenChange,
  initialFrom,
  initialTo,
  onApply,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initialFrom: string
  initialTo: string
  onApply: (from: string, to: string) => void
}) {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)

  useEffect(() => {
    if (open) {
      setFrom(initialFrom)
      setTo(initialTo)
    }
  }, [open, initialFrom, initialTo])

  const invalid = !from || !to || new Date(from) > new Date(to)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[rgba(31,29,26,0.35)] backdrop-blur-[2px] tq-fade-in" />
        <Dialog.Popup
          className={cn(
            "fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-[min(calc(100vw-32px),420px)]",
            "bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-result",
            "tq-scale-in"
          )}
        >
          <div className="px-6 pt-6 pb-5 border-b border-[var(--border)]">
            <MicroLabel>Custom range</MicroLabel>
            <Dialog.Title className="font-serif text-[26px] font-normal tracking-[-0.02em] leading-[1.1] mt-2 mb-0">
              Pick a date range
            </Dialog.Title>
            <Dialog.Description className="text-[13px] text-[var(--muted-fg)] leading-[1.5] mt-2 mb-0">
              Stats will cover responses between these dates, inclusive.
            </Dialog.Description>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            <div>
              <label className="block">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--muted-fg)] font-medium">
                  From
                </span>
                <input
                  type="date"
                  className="tq-input mt-[6px]"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  max={to || undefined}
                />
              </label>
            </div>
            <div>
              <label className="block">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--muted-fg)] font-medium">
                  To
                </span>
                <input
                  type="date"
                  className="tq-input mt-[6px]"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  min={from || undefined}
                />
              </label>
            </div>
            {from && to && new Date(from) > new Date(to) && (
              <div className="text-[12px] text-[var(--red)]">
                &ldquo;From&rdquo; must come before &ldquo;To&rdquo;.
              </div>
            )}
          </div>
          <div className="px-6 py-4 bg-[var(--background)] border-t border-[var(--border)] flex justify-end gap-2 rounded-b-[12px]">
            <Dialog.Close render={<Button variant="secondary" size="sm">Cancel</Button>} />
            <Button
              size="sm"
              disabled={invalid}
              onClick={() => {
                if (!invalid) onApply(from, to)
              }}
            >
              Apply
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

