"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Stat } from "@/components/ui/typography"
import { QuizGrid } from "./quiz-grid"

type QuizRow = {
  id: string
  title: string
  created_at: string
  responses: { id: string; completed_at: string | null; started_at: string | null }[]
}

type Win = { from: number | null; to: number | null }

function inWindow(iso: string | null | undefined, win: Win): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (win.from !== null && t < win.from) return false
  if (win.to !== null && t > win.to) return false
  return true
}

function count(rows: QuizRow[], win: Win, field: "starts" | "completions") {
  let n = 0
  for (const q of rows) {
    for (const r of q.responses || []) {
      const ts = field === "completions" ? r.completed_at : r.started_at
      if (!ts) continue
      if (inWindow(ts, win)) n++
    }
  }
  return n
}

function fmtDelta(recent: number, prev: number, unit: "pct" | "pp" = "pct") {
  if (!prev || !recent) return undefined
  const d = ((recent - prev) / prev) * 100
  if (!isFinite(d)) return undefined
  const rounded = Math.round(d)
  const sign = rounded >= 0 ? "+" : ""
  return `${sign}${rounded}${unit === "pp" ? "pp" : "%"} vs prev`
}

/**
 * Wraps the dashboard stats row + quiz grid. Filters the full quiz set
 * down to quizzes this browser created (via localStorage), then computes
 * stats from the filtered slice so the numbers match what's visible.
 * Stats stay frozen on server output until localStorage is read to avoid
 * a hydration mismatch.
 */
export function DashboardBody({
  quizzes,
  win,
  prev,
  rangeShort,
}: {
  quizzes: QuizRow[]
  win: Win
  prev: Win
  rangeShort: string
}) {
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem("createdQuizzes")
      const list: string[] = raw ? JSON.parse(raw) : []
      setOwnedIds(new Set(list))
    } catch {
      setOwnedIds(new Set())
    }
  }, [])

  const visible = useMemo(
    () => (ownedIds ? quizzes.filter((q) => ownedIds.has(q.id)) : []),
    [quizzes, ownedIds]
  )

  // Empty state — owner check has resolved and they have nothing.
  if (ownedIds && visible.length === 0) {
    return (
      <div className="text-center py-16 md:py-24">
        <h2 className="font-serif text-[32px] md:text-[40px] font-normal tracking-[-0.025em] leading-[1.1] mb-[10px]">
          No <em className="italic">quizzes</em> yet
        </h2>
        <p className="text-[15px] text-[var(--muted-fg)] max-w-[420px] mx-auto mb-6 leading-[1.55]">
          Describe your first quiz in a sentence — we&apos;ll draft the questions,
          scoring, and a shareable result page for you.
        </p>
        <div className="flex gap-[10px] justify-center">
          <Link href="/">
            <Button size="lg">Draft your first quiz</Button>
          </Link>
        </div>
      </div>
    )
  }

  const startsRecent = count(visible, win, "starts")
  const startsPrev = count(visible, prev, "starts")
  const completionsRecent = count(visible, win, "completions")
  const completionsPrev = count(visible, prev, "completions")
  const rateRecent = startsRecent ? Math.round((completionsRecent / startsRecent) * 100) : 0
  const ratePrev = startsPrev ? Math.round((completionsPrev / startsPrev) * 100) : 0

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-[var(--border)] rounded-[10px] bg-[var(--surface)] overflow-hidden">
        <StatCell
          label={`Starts · ${rangeShort}`}
          value={startsRecent.toLocaleString()}
          delta={fmtDelta(startsRecent, startsPrev)}
          borderRight
        />
        <StatCell
          label={`Completions · ${rangeShort}`}
          value={completionsRecent.toLocaleString()}
          delta={fmtDelta(completionsRecent, completionsPrev)}
          borderRightMdOnly
        />
        <StatCell
          label="Avg. rate"
          value={`${rateRecent}%`}
          delta={fmtDelta(rateRecent, ratePrev, "pp")}
          borderRight
          borderTopOnMobile
        />
        <StatCell
          label="Total quizzes"
          value={visible.length.toString()}
          borderTopOnMobile
        />
      </div>

      <QuizGrid quizzes={visible} />
    </>
  )
}

function StatCell({
  label,
  value,
  delta,
  borderRight,
  borderRightMdOnly,
  borderTopOnMobile,
}: {
  label: string
  value: string
  delta?: string
  borderRight?: boolean
  borderRightMdOnly?: boolean
  borderTopOnMobile?: boolean
}) {
  return (
    <div
      className={`p-[18px] md:p-[22px_24px] ${
        borderRight ? "border-r border-[var(--border)]" : ""
      } ${borderRightMdOnly ? "md:border-r md:border-[var(--border)]" : ""} ${
        borderTopOnMobile ? "border-t border-[var(--border)] md:border-t-0" : ""
      }`}
    >
      <Stat label={label} value={value} delta={delta} />
    </div>
  )
}
