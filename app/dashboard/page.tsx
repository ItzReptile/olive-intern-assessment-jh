import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { RateBadge } from "@/components/ui/rate-badge"
import { MicroLabel, MonoURL, Stat } from "@/components/ui/typography"
import { Nav } from "@/components/nav"
import { QuizGrid } from "./quiz-grid"
import { RangeFilter } from "@/components/range-filter"
import { parseRangeFromSearch, prevWindow, inWindow, type RangeWindow } from "@/lib/range"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type QuizRow = {
  id: string
  title: string
  created_at: string
  responses: { id: string; completed_at: string | null; started_at: string | null }[]
}

function slug(id: string, title: string) {
  const clean = (title || "quiz")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16)
  return `${clean}-${id.slice(0, 4)}`
}

function relTime(iso: string | null | undefined) {
  if (!iso) return "—"
  const d = new Date(iso).getTime()
  const diff = (Date.now() - d) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString()
}

function countRange(
  rows: QuizRow[],
  win: RangeWindow,
  field: "starts" | "completions"
) {
  let n = 0
  for (const q of rows) {
    for (const r of q.responses || []) {
      if (field === "completions") {
        if (!r.completed_at) continue
        if (inWindow(r.completed_at, win)) n++
      } else {
        if (!r.started_at) continue
        if (inWindow(r.started_at, win)) n++
      }
    }
  }
  return n
}

const RANGE_SHORT: Record<string, string> = {
  "7d": "7d",
  "30d": "30d",
  all: "all time",
  custom: "custom",
}

function fmtDelta(recent: number, prev: number, unit: "pct" | "pp" = "pct") {
  if (!prev || !recent) return undefined
  const d = ((recent - prev) / prev) * 100
  if (!isFinite(d)) return undefined
  const rounded = Math.round(d)
  const sign = rounded >= 0 ? "+" : ""
  return `${sign}${rounded}${unit === "pp" ? "pp" : "%"} vs prev`
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const win = parseRangeFromSearch(sp)
  const prev = prevWindow(win)
  const rangeKey = sp.range ?? "30d"
  const rangeShort = RANGE_SHORT[rangeKey] ?? rangeKey

  // Narrow select — dashboard grid doesn't need the full spec JSONB or prompt.
  // Cuts per-row payload by ~90% on quizzes with large generated specs.
  const { data } = await supabase
    .from("quizzes")
    .select("id, title, created_at, responses(id, completed_at, started_at)")
    .order("created_at", { ascending: false })

  const quizzes = (data ?? []) as QuizRow[]

  const startsRecent = countRange(quizzes, win, "starts")
  const startsPrev = countRange(quizzes, prev, "starts")
  const completionsRecent = countRange(quizzes, win, "completions")
  const completionsPrev = countRange(quizzes, prev, "completions")
  const rateRecent = startsRecent ? Math.round((completionsRecent / startsRecent) * 100) : 0
  const ratePrev = startsPrev ? Math.round((completionsPrev / startsPrev) * 100) : 0

  const hasAny = quizzes.length > 0

  return (
    <main className="min-h-screen flex flex-col">
      <Nav active="dashboard" className="hidden md:flex" />
      <Nav active="dashboard" mobile className="flex md:hidden" />

      {!hasAny ? (
        <DashboardEmpty />
      ) : (
        <section className="px-5 md:px-18 py-8 md:py-10 pb-16" style={{}}>
          <div className="mx-auto max-w-[1136px]">
            {/* Header */}
            <div className="flex justify-between items-end mb-7">
              <div>
                <MicroLabel>Workspace · personal</MicroLabel>
                <h1 className="font-serif text-[32px] md:text-[44px] font-normal tracking-[-0.025em] leading-none mt-2 mb-0">
                  Your <em className="italic">quizzes</em>
                </h1>
              </div>
              <div className="hidden md:flex gap-2">
                <Link href="/">
                  <Button>+ New quiz</Button>
                </Link>
              </div>
              <div className="flex md:hidden">
                <Link href="/">
                  <Button size="sm">+ New</Button>
                </Link>
              </div>
            </div>

            {/* Range filter */}
            <div className="flex justify-end mb-3">
              <RangeFilter />
            </div>

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
                value={quizzes.length.toString()}
                borderTopOnMobile
              />
            </div>

            {/* Sub-header */}
            <QuizGrid quizzes={quizzes} />
          </div>
        </section>
      )}
    </main>
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

function DashboardEmpty() {
  return (
    <section className="flex-1 flex items-center justify-center px-5 py-20 md:py-24">
      <div className="text-center max-w-[460px]">
        <h2 className="font-serif text-[32px] md:text-[40px] font-normal tracking-[-0.025em] leading-[1.1] mb-[10px]">
          No <em className="italic">quizzes</em> yet
        </h2>
        <p className="text-[15px] text-[var(--muted-fg)] max-w-[420px] mx-auto mb-6 leading-[1.55]">
          Describe your first quiz in a sentence — we&apos;ll draft the questions, scoring, and a shareable result page for you.
        </p>
        <div className="flex gap-[10px] justify-center">
          <Link href="/">
            <Button size="lg">Draft your first quiz</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
