"use client"

import { memo, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { RateBadge } from "@/components/ui/rate-badge"
import { MicroLabel, MonoURL } from "@/components/ui/typography"
import { cn } from "@/lib/utils"

type QuizRowLite = {
  id: string
  title: string
  created_at: string
  responses: { completed_at: string | null; started_at: string | null }[]
}

type Sort = "recent" | "oldest" | "most_responses" | "highest_rate"
type View = "grid" | "list"

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "oldest", label: "Oldest" },
  { value: "most_responses", label: "Most responses" },
  { value: "highest_rate", label: "Highest rate" },
]

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
]

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

export function QuizGrid({ quizzes }: { quizzes: QuizRowLite[] }) {
  const [sort, setSort] = useState<Sort>("recent")
  const [view, setView] = useState<View>("grid")
  const [sortOpen, setSortOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)

  const sorted = useMemo(() => {
    // Precompute expensive per-row stats once per sort change
    const stats = new Map<string, { started: number; completed: number; rate: number }>()
    for (const q of quizzes) {
      const started = q.responses?.length ?? 0
      const completed = q.responses?.filter((r) => r.completed_at).length ?? 0
      stats.set(q.id, {
        started,
        completed,
        rate: started ? completed / started : 0,
      })
    }
    return [...quizzes].sort((a, b) => {
      const sa = stats.get(a.id)!
      const sb = stats.get(b.id)!
      switch (sort) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "most_responses":
          return sb.started - sa.started
        case "highest_rate":
          return sb.rate - sa.rate
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
  }, [quizzes, sort])

  return (
    <>
      <div className="flex justify-between items-center mt-10 mb-4">
        <MicroLabel>Your quizzes · {quizzes.length}</MicroLabel>
        <div className="hidden md:flex gap-[18px] items-center">
          <Dropdown
            label="Sort"
            value={SORT_OPTIONS.find((o) => o.value === sort)!.label}
            options={SORT_OPTIONS}
            open={sortOpen}
            onToggle={() => {
              setSortOpen((v) => !v)
              setViewOpen(false)
            }}
            onPick={(v) => {
              setSort(v as Sort)
              setSortOpen(false)
            }}
          />
          <Dropdown
            label="View"
            value={VIEW_OPTIONS.find((o) => o.value === view)!.label}
            options={VIEW_OPTIONS}
            open={viewOpen}
            onToggle={() => {
              setViewOpen((v) => !v)
              setSortOpen(false)
            }}
            onPick={(v) => {
              setView(v as View)
              setViewOpen(false)
            }}
          />
        </div>
      </div>

      <div
        className={cn(
          view === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-[18px]"
            : "flex flex-col gap-3"
        )}
      >
        {sorted.map((q) => (
          <QuizTile key={q.id} q={q} compact={view === "list"} />
        ))}
        <EmptyTile compact={view === "list"} />
      </div>
    </>
  )
}

function Dropdown({
  label,
  value,
  options,
  open,
  onToggle,
  onPick,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  open: boolean
  onToggle: () => void
  onPick: (value: string) => void
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-[6px] font-mono text-[11px] text-[var(--muted-fg)] hover:text-[var(--foreground)] transition-colors"
      >
        <span>{label}:</span>
        <span className="text-[var(--foreground)]">{value}</span>
        <span className="text-[var(--faint)]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 min-w-[180px] bg-[var(--surface)] border border-[var(--border)] rounded-[8px] shadow-card-hover z-20 overflow-hidden">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onPick(o.value)}
              className={cn(
                "block w-full text-left px-[14px] py-[9px] text-[13px] transition-colors",
                value === o.label
                  ? "bg-[var(--olive-tint)] text-[var(--olive-dark)]"
                  : "text-[var(--foreground)] hover:bg-[var(--muted)]"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Memoized — avoids re-rendering every tile when a sibling (dropdown) toggles.
// Only re-renders when q or compact changes.
const QuizTile = memo(function QuizTile({
  q,
  compact,
}: {
  q: QuizRowLite
  compact: boolean
}) {
  const started = q.responses?.length ?? 0
  const completed = q.responses?.filter((r) => r.completed_at).length ?? 0
  const rate = started ? Math.round((completed / started) * 100) : 0
  const lastUpdated =
    q.responses?.[0]?.completed_at ?? q.responses?.[0]?.started_at ?? q.created_at

  if (compact) {
    return (
      <Link href={`/dashboard/${q.id}`} className="group">
        <Card padding={16} hoverable>
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="font-serif text-[17px] tracking-[-0.015em] text-[var(--foreground)] truncate">
                {q.title}
              </div>
              <MonoURL className="block mt-[2px] !text-[11px]">
                Updated {relTime(lastUpdated)}
              </MonoURL>
            </div>
            <div className="hidden sm:flex items-center gap-5 text-[13px] text-[var(--muted-fg)]">
              <div className="font-mono">{started.toLocaleString()} started</div>
              <div className="font-mono">{completed.toLocaleString()} done</div>
              <MonoURL className="!text-[11px] whitespace-nowrap">
                {relTime(lastUpdated)}
              </MonoURL>
            </div>
            <RateBadge value={rate} />
          </div>
        </Card>
      </Link>
    )
  }

  return (
    <Link href={`/dashboard/${q.id}`} className="group">
      <Card padding={22} hoverable className="h-full">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <div className="font-serif text-[19px] md:text-[22px] tracking-[-0.015em] leading-[1.15] text-[var(--foreground)] truncate">
              {q.title}
            </div>
            <MonoURL className="block mt-1">Updated {relTime(lastUpdated)}</MonoURL>
          </div>
          <RateBadge value={rate} />
        </div>
        <div className="flex gap-7 mt-5">
          <div>
            <MicroLabel>Started</MicroLabel>
            <div className="font-mono text-[18px] mt-1 tracking-[-0.01em]">
              {started.toLocaleString()}
            </div>
          </div>
          <div>
            <MicroLabel>Completed</MicroLabel>
            <div className="font-mono text-[18px] mt-1 tracking-[-0.01em]">
              {completed.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={rate} />
        </div>
        <div className="mt-4 pt-[14px] border-t border-[var(--border)] flex justify-between items-center">
          <MonoURL className="!text-[11px]">Updated {relTime(lastUpdated)}</MonoURL>
          <span className="text-[13px] text-[var(--olive-dark)] group-hover:underline underline-offset-4">
            View stats →
          </span>
        </div>
      </Card>
    </Link>
  )
})

const EmptyTile = memo(function EmptyTile({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <Link href="/" className="block">
        <Card padding={16} hoverable className="border-dashed border-[var(--border-strong)]">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="font-serif text-[17px] tracking-[-0.015em] text-[var(--foreground)]">
                Draft a new quiz
              </div>
              <MonoURL className="block mt-[2px] !text-[11px]">
                Start from a sentence, or duplicate an existing one.
              </MonoURL>
            </div>
            <Button size="sm" variant="secondary">
              New quiz →
            </Button>
          </div>
        </Card>
      </Link>
    )
  }

  return (
    <Link href="/" className="block">
      <div className="rounded-[10px] border border-dashed border-[var(--border-strong)] p-[22px] flex flex-col items-center justify-center text-center h-full min-h-[240px] bg-transparent hover:bg-[var(--surface)] transition-colors">
        <div className="font-serif text-[20px] text-[var(--foreground)] tracking-[-0.015em]">
          Draft a new quiz
        </div>
        <p className="text-[12.5px] text-[var(--muted-fg)] max-w-[240px] m-0 mt-[8px] mb-[16px]">
          Start from a sentence, or duplicate an existing one.
        </p>
        <Button size="sm" variant="secondary">
          New quiz →
        </Button>
      </div>
    </Link>
  )
})
