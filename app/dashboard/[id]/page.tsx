import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { MicroLabel, MonoURL, Stat } from "@/components/ui/typography"
import { Nav } from "@/components/nav"
import type { QuizSpec } from "@/lib/quiz-schema"
import { CopyLink } from "./copy-link"
import { DeleteQuizButton } from "./delete-button"
import { RangeFilter } from "@/components/range-filter"
import { parseRangeFromSearch, inWindow } from "@/lib/range"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ResponseRow = {
  id: string
  version: number | null
  score: number | null
  result_title: string | null
  started_at: string | null
  completed_at: string | null
  answers: Record<string, any> | null
}

type QuizRow = {
  id: string
  title: string
  description: string
  spec: QuizSpec
  version: number | null
  created_at: string
  responses: ResponseRow[]
}

const RESULT_PALETTE = [
  "var(--olive)",
  "#b5c29a",
  "#c99a2e",
  "#c4a893",
  "#9a958c",
]

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
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days < 2) return `Yest. · ${new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  return `Today · ${new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

function fmtDuration(ms: number) {
  if (!isFinite(ms) || ms <= 0) return "—"
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m === 0) return `${s}s`
  return `${m}m ${rem.toString().padStart(2, "0")}s`
}

export default async function DrillDown({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string; v?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const win = parseRangeFromSearch(sp)
  // Version filter: "current" | "all" (default) | "N" for a specific version
  const versionFilter = sp.v ?? "all"

  // Explicit columns beat `select("*")` — faster parse, smaller payload,
  // and future DB additions (e.g. auth columns) won't leak into the client.
  const { data, error } = await supabase
    .from("quizzes")
    .select(
      "id, title, description, spec, version, created_at, responses(id, version, score, result_title, started_at, completed_at, answers)"
    )
    .eq("id", id)
    .single()

  if (error || !data) return notFound()

  const quiz = data as QuizRow
  const currentVersion = quiz.version ?? 1
  const allResponses = quiz.responses ?? []

  // Versions present in the response set — powers the filter chip row.
  const versionsPresent = Array.from(
    new Set(allResponses.map((r) => r.version ?? 1))
  ).sort((a, b) => b - a)

  // Which version(s) to include.
  function matchesVersion(r: ResponseRow) {
    if (versionFilter === "all") return true
    if (versionFilter === "current") return (r.version ?? 1) === currentVersion
    const v = parseInt(versionFilter, 10)
    return !isNaN(v) && (r.version ?? 1) === v
  }

  // Filter by time window + version filter.
  const responses = allResponses.filter(
    (r) => inWindow(r.started_at, win) && matchesVersion(r)
  )
  const completed = allResponses.filter(
    (r) => r.completed_at && inWindow(r.completed_at, win) && matchesVersion(r)
  )

  // Question breakdown only makes sense for responses that match the current
  // spec (respondents on older versions answered different questions). Track
  // how many completed responses are being hidden from the breakdown so we
  // can show an honest note to the creator.
  const completedCurrentVersion = completed.filter(
    (r) => (r.version ?? 1) === currentVersion
  )
  const hiddenFromBreakdown = completed.length - completedCurrentVersion.length

  const starts = responses.length
  const completions = completed.length
  const completionRate = starts ? Math.round((completions / starts) * 100) : 0
  const avgScore =
    completions > 0
      ? (completed.reduce((a, r) => a + (r.score ?? 0), 0) / completions).toFixed(1)
      : "—"

  const avgDurationMs =
    completions > 0
      ? completed.reduce((a, r) => {
          if (!r.started_at || !r.completed_at) return a
          return a + (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime())
        }, 0) / completions
      : 0

  // Result distribution
  const distroMap = new Map<string, number>()
  for (const r of completed) {
    if (!r.result_title) continue
    distroMap.set(r.result_title, (distroMap.get(r.result_title) ?? 0) + 1)
  }
  const distribution = [...distroMap.entries()]
    .map(([title, count]) => ({
      title,
      count,
      pct: completions ? Math.round((count / completions) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const maxPct = Math.max(1, ...distribution.map((d) => d.pct))
  const colorByTitle = new Map<string, string>()
  distribution.forEach((d, i) => {
    colorByTitle.set(d.title, RESULT_PALETTE[i] || RESULT_PALETTE[RESULT_PALETTE.length - 1])
  })

  const topResult = distribution[0]?.title ?? "—"
  const mobileShare = "—" // not tracked

  const recent = [...responses]
    .sort((a, b) => {
      const aTs = a.completed_at ?? a.started_at ?? ""
      const bTs = b.completed_at ?? b.started_at ?? ""
      return new Date(bTs).getTime() - new Date(aTs).getTime()
    })
    .slice(0, 8)

  const quizSlug = slug(quiz.id, quiz.title)

  // Pick drop-off question (stub: last question — no real drop-off data)
  const dropOffQ = quiz.spec.questions.length
  const dropOffLabel = `Q${dropOffQ}`

  return (
    <main className="min-h-screen flex flex-col">
      <Nav active="dashboard" className="hidden md:flex" />
      <Nav active="dashboard" mobile className="flex md:hidden" />

      <section className="px-5 md:px-18 py-6 md:py-8 pb-16">
        <div className="mx-auto max-w-[1136px]">
          {/* Header */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-[6px] text-[12.5px] text-[var(--muted-fg)] no-underline hover:text-[var(--foreground)] transition-colors"
          >
            ← All quizzes
          </Link>
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 md:gap-0 mt-[18px]">
            <div>
              <h1 className="font-serif text-[32px] md:text-[44px] font-normal tracking-[-0.025em] leading-none m-0">
                {renderTitle(quiz.title)}
              </h1>
              <div className="mt-[10px] flex gap-3 items-center flex-wrap">
                <MonoURL>textoquiz.app/q/{quizSlug}</MonoURL>
                <span className="text-[var(--faint)]">·</span>
                <Pill variant={completions > 0 ? "olive" : "default"} className="!text-[11.5px] !py-[3px] !px-[9px]">
                  {completions > 0 ? "Published" : "Draft"}
                </Pill>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Link href={`/dashboard/${quiz.id}/preview`}>
                <Button variant="secondary" size="sm">
                  Preview
                </Button>
              </Link>
              <Link href={`/quiz/${quiz.id}`}>
                <Button variant="secondary" size="sm">
                  Take as user
                </Button>
              </Link>
              <CopyLink url={`/quiz/${quiz.id}`} />
              <DeleteQuizButton quizId={quiz.id} title={quiz.title} />
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap justify-between items-center gap-3 mt-6 mb-3">
            {versionsPresent.length > 1 ? (
              <VersionFilter
                current={currentVersion}
                versions={versionsPresent}
                selected={versionFilter}
                sp={sp}
              />
            ) : (
              <div />
            )}
            <RangeFilter />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-[var(--border)] rounded-[10px] bg-[var(--surface)] overflow-hidden">
            <StatCell label="Starts" value={starts.toLocaleString()} borderRight />
            <StatCell
              label="Completions"
              value={completions.toLocaleString()}
              borderRightMdOnly
            />
            <StatCell
              label="Completion"
              value={`${completionRate}%`}
              borderRight
              borderTopOnMobile
            />
            <StatCell label="Avg. score" value={avgScore.toString()} borderTopOnMobile />
          </div>

          {/* Chart + At a glance */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
            <div>
              <div className="flex justify-between items-baseline mb-4">
                <div className="font-serif italic text-[20px] md:text-[22px]">
                  Result distribution
                </div>
                <MonoURL className="!text-[11px]">
                  Last 30 days · {completions}
                </MonoURL>
              </div>
              <Card padding={24}>
                {distribution.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <DistributionChart
                    rows={distribution}
                    maxPct={maxPct}
                    colorByTitle={colorByTitle}
                  />
                )}
              </Card>
            </div>
            <div>
              <div className="font-serif italic text-[20px] md:text-[22px] mb-4">
                At a glance
              </div>
              <Card padding={22}>
                <div className="flex flex-col gap-[14px]">
                  <Row label="Top result">
                    <span
                      className="font-serif italic text-[15px]"
                      style={{ color: colorByTitle.get(topResult) ?? "var(--olive-dark)" }}
                    >
                      {topResult}
                    </span>
                  </Row>
                  <Row label="Avg. time to complete">
                    <span className="font-mono">{fmtDuration(avgDurationMs)}</span>
                  </Row>
                  <Row label="Drop-off question">
                    <Link
                      href={`/quiz/${quiz.id}?q=${dropOffQ}`}
                      className="font-mono text-[var(--foreground)] hover:text-[var(--olive-dark)] underline underline-offset-4 decoration-[var(--border-strong)] hover:decoration-[var(--olive-dark)] transition-colors"
                    >
                      {dropOffLabel}
                    </Link>
                  </Row>
                  <Row label="Mobile share">
                    <span className="font-mono">{mobileShare}</span>
                  </Row>
                </div>
              </Card>
            </div>
          </div>

          {/* Question breakdown — only current-version responses can be
              cleanly mapped to the current spec's questions */}
          {completedCurrentVersion.length > 0 && (
            <div className="mt-11 max-w-[820px]">
              <div className="flex justify-between items-baseline mb-4">
                <div className="font-serif italic text-[20px] md:text-[22px]">
                  Question breakdown
                </div>
                <MonoURL className="!text-[11px]">
                  Across {completedCurrentVersion.length} completed on v{currentVersion}
                </MonoURL>
              </div>
              {hiddenFromBreakdown > 0 && (
                <div className="mb-3 text-[12.5px] text-[var(--muted-fg)] italic">
                  {hiddenFromBreakdown} response{hiddenFromBreakdown === 1 ? "" : "s"} from
                  earlier versions aren&apos;t shown here — their questions may differ from
                  the current ones. Use the version filter to view them individually.
                </div>
              )}
              <QuestionBreakdown spec={quiz.spec} completed={completedCurrentVersion} />
            </div>
          )}

          {/* Recent responses */}
          <div className="mt-11">
            <div className="flex justify-between items-baseline mb-4">
              <div className="font-serif italic text-[20px] md:text-[22px]">
                Recent responses
              </div>
              <MonoURL className="!text-[11px]">
                Showing {recent.length} of {responses.length}
              </MonoURL>
            </div>

            {responses.length === 0 ? (
              <EmptyResponses quizId={quiz.id} />
            ) : (
              <ResponsesTable
                rows={recent}
                colorByTitle={colorByTitle}
                maxScore={deriveMax(quiz.spec)}
                currentVersion={currentVersion}
                showVersionCol={versionsPresent.length > 1}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function renderTitle(t: string) {
  const words = t.split(" ")
  if (words.length === 1) return <em className="italic">{t}</em>
  const last = words[words.length - 1]
  const rest = words.slice(0, -1).join(" ")
  return (
    <>
      {rest} <em className="italic">{last}</em>
    </>
  )
}

function deriveMax(spec: QuizSpec) {
  let total = 0
  for (const q of spec.questions) {
    if (q.type === "multiple-choice") total += Math.max(0, ...q.options.map((o) => o.score)) * q.weight
    else if (q.type === "yes-no") total += Math.max(q.yes_score, q.no_score) * q.weight
    else if (q.type === "scale") total += 5 * q.weight
  }
  return total
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-[13px]">
      <span className="text-[var(--muted-fg)]">{label}</span>
      {children}
    </div>
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
      className={`p-[16px] md:p-[22px_24px] ${
        borderRight ? "border-r border-[var(--border)]" : ""
      } ${borderRightMdOnly ? "md:border-r md:border-[var(--border)]" : ""} ${
        borderTopOnMobile ? "border-t border-[var(--border)] md:border-t-0" : ""
      }`}
    >
      <Stat label={label} value={value} delta={delta} />
    </div>
  )
}

function DistributionChart({
  rows,
  maxPct,
  colorByTitle,
}: {
  rows: { title: string; count: number; pct: number }[]
  maxPct: number
  colorByTitle: Map<string, string>
}) {
  return (
    <div className="flex flex-col gap-[14px]">
      {rows.map((d) => {
        const w = (d.pct / maxPct) * 100
        const color = colorByTitle.get(d.title) ?? "var(--olive)"
        return (
          <div key={d.title}>
            <div className="flex justify-between text-[12.5px] text-[var(--muted-fg)] mb-[6px]">
              <span
                className="font-serif italic text-[15px]"
                style={{ color }}
              >
                {d.title}
              </span>
              <span className="font-mono">
                <span className="text-[var(--foreground)]">{d.count}</span>
                <span className="ml-[10px]">{d.pct}%</span>
              </span>
            </div>
            <div
              className="rounded-[4px] overflow-hidden relative bg-[var(--border)]"
              style={{ height: 28 }}
            >
              <div
                className="h-full rounded-[4px]"
                style={{ width: `${w}%`, backgroundColor: color, transition: "width 0.6s cubic-bezier(.2,.7,.3,1)" }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="text-center py-10">
      <div className="font-serif italic text-[20px] text-[var(--foreground)]">
        No completions yet
      </div>
      <p className="text-[13px] text-[var(--muted-fg)] mt-2">
        Once people finish the quiz, their result mix shows up here.
      </p>
    </div>
  )
}

function EmptyResponses({ quizId }: { quizId: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-[var(--border-strong)] px-6 py-16 text-center">
      <div className="font-serif text-[24px] tracking-[-0.02em]">No responses yet</div>
      <p className="text-[13.5px] text-[var(--muted-fg)] mt-2 mb-4 max-w-[340px] mx-auto">
        Share the link — responses will appear here as people complete the quiz.
      </p>
      <Link href={`/quiz/${quizId}`}>
        <Button variant="secondary" size="sm">
          Preview quiz
        </Button>
      </Link>
    </div>
  )
}

function ResponsesTable({
  rows,
  colorByTitle,
  maxScore,
  currentVersion,
  showVersionCol,
}: {
  rows: ResponseRow[]
  colorByTitle: Map<string, string>
  maxScore: number
  currentVersion: number
  showVersionCol: boolean
}) {
  const grid = showVersionCol
    ? "grid-cols-[1.1fr_0.6fr_0.8fr_1fr] md:grid-cols-[1.2fr_0.5fr_0.8fr_1fr_0.4fr]"
    : "grid-cols-[1.1fr_0.8fr_1fr] md:grid-cols-[1.2fr_0.8fr_1fr_0.4fr]"

  return (
    <div className="border border-[var(--border)] rounded-[10px] bg-[var(--surface)] overflow-hidden">
      <div className={`grid ${grid} px-[18px] py-[10px] bg-[var(--background)] border-b border-[var(--border)]`}>
        <MicroLabel>Time</MicroLabel>
        {showVersionCol && <MicroLabel>Version</MicroLabel>}
        <MicroLabel>Score</MicroLabel>
        <MicroLabel>Result</MicroLabel>
        <MicroLabel className="hidden md:block text-right">—</MicroLabel>
      </div>
      {rows.map((r, i) => {
        const color = r.result_title
          ? colorByTitle.get(r.result_title) ?? "var(--olive-dark)"
          : "var(--muted-fg)"
        const v = r.version ?? 1
        const isCurrent = v === currentVersion
        return (
          <div
            key={r.id}
            className={`grid ${grid} px-[18px] py-[14px] items-center text-[13.5px] ${
              i < rows.length - 1 ? "border-b border-[var(--border)]" : ""
            }`}
          >
            <MonoURL className="!text-[12px]">{relTime(r.completed_at ?? r.started_at)}</MonoURL>
            {showVersionCol && (
              <span
                className={`font-mono text-[11px] px-[7px] py-[2px] rounded-[4px] border inline-flex items-center justify-center w-fit ${
                  isCurrent
                    ? "bg-[var(--olive-tint)] text-[var(--olive-dark)] border-[var(--olive-tint-border)]"
                    : "bg-[var(--background)] text-[var(--muted-fg)] border-[var(--border)]"
                }`}
              >
                v{v}
              </span>
            )}
            <span className="font-mono text-[13px] text-[var(--foreground)]">
              {r.score ?? 0}/{maxScore}
            </span>
            <span className="font-serif italic text-[15px]" style={{ color }}>
              {r.result_title ?? "—"}
            </span>
            <span className="hidden md:block text-right text-[12px] text-[var(--muted-fg)]">—</span>
          </div>
        )
      })}
    </div>
  )
}

function VersionFilter({
  current,
  versions,
  selected,
  sp,
}: {
  current: number
  versions: number[]
  selected: string
  sp: { range?: string; from?: string; to?: string; v?: string }
}) {
  function hrefFor(v: string) {
    const params = new URLSearchParams()
    if (sp.range) params.set("range", sp.range)
    if (sp.from) params.set("from", sp.from)
    if (sp.to) params.set("to", sp.to)
    if (v !== "all") params.set("v", v)
    const qs = params.toString()
    return qs ? `?${qs}` : ""
  }
  const Chip = ({ value, label }: { value: string; label: string }) => {
    const active = selected === value
    return (
      <Link
        href={hrefFor(value)}
        className={`font-mono text-[11px] px-[9px] py-[4px] rounded-[5px] border transition-colors no-underline ${
          active
            ? "bg-[var(--olive-tint)] text-[var(--olive-dark)] border-[var(--olive-tint-border)]"
            : "bg-[var(--surface)] text-[var(--muted-fg)] border-[var(--border)] hover:text-[var(--foreground)]"
        }`}
      >
        {label}
      </Link>
    )
  }
  return (
    <div className="flex items-center gap-[6px] flex-wrap">
      <MicroLabel className="!text-[var(--muted-fg)] mr-1">Version:</MicroLabel>
      <Chip value="all" label={`All (${versions.length})`} />
      <Chip value="current" label={`Current · v${current}`} />
      {versions
        .filter((v) => v !== current)
        .map((v) => (
          <Chip key={v} value={String(v)} label={`v${v}`} />
        ))}
    </div>
  )
}

function QuestionBreakdown({
  spec,
  completed,
}: {
  spec: QuizSpec
  completed: ResponseRow[]
}) {
  return (
    <div className="flex flex-col gap-3">
      {spec.questions.map((q, idx) => (
        <QuestionBreakdownRow key={q.id} q={q} index={idx} completed={completed} />
      ))}
    </div>
  )
}

function QuestionBreakdownRow({
  q,
  index,
  completed,
}: {
  q: QuizSpec["questions"][number]
  index: number
  completed: ResponseRow[]
}) {
  const answered = completed.filter((r) => {
    const a = (r as any).answers?.[q.id]
    return a !== undefined && a !== null && a !== ""
  })
  const answeredCount = answered.length

  const typeLabel: Record<typeof q.type, string> = {
    "multiple-choice": "Multiple choice",
    "yes-no": "Yes / No",
    scale: "Scale 1–5",
    "free-text": "Free response",
  }

  return (
    <Card padding={18}>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-[11px] text-[var(--faint)] min-w-[22px]">
          Q{index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-[var(--foreground)] leading-[1.4]">
            {q.question}
          </div>
          <div className="mt-[3px] flex gap-3 items-center">
            <MicroLabel>{typeLabel[q.type]}</MicroLabel>
            <span className="text-[11.5px] text-[var(--muted-fg)] font-mono">
              {answeredCount} answered
            </span>
          </div>
        </div>
      </div>

      {answeredCount === 0 ? (
        <div className="text-[12.5px] text-[var(--faint)] italic pl-[34px]">
          No answers yet.
        </div>
      ) : q.type === "multiple-choice" ? (
        <MCDistribution q={q as any} answered={answered} />
      ) : q.type === "yes-no" ? (
        <YesNoDistribution q={q as any} answered={answered} />
      ) : q.type === "scale" ? (
        <ScaleDistribution q={q as any} answered={answered} />
      ) : (
        <FreeTextSample answered={answered} qid={q.id} />
      )}
    </Card>
  )
}

function DistRow({
  label,
  count,
  total,
  highlight,
}: {
  label: React.ReactNode
  count: number
  total: number
  highlight?: boolean
}) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div className="pl-[34px]">
      <div className="flex justify-between text-[12.5px] mb-[5px]">
        <span className={highlight ? "text-[var(--olive-dark)] font-medium" : "text-[var(--foreground)]"}>
          {label}
        </span>
        <span className="font-mono text-[var(--muted-fg)]">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-[6px] bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: highlight ? "var(--olive)" : "#b5c29a",
          }}
        />
      </div>
    </div>
  )
}

function MCDistribution({
  q,
  answered,
}: {
  q: { id: string; options: { id: string; text: string; score: number }[] }
  answered: ResponseRow[]
}) {
  const counts = new Map<string, number>()
  for (const r of answered) {
    const a = (r as any).answers?.[q.id]
    if (typeof a === "string") counts.set(a, (counts.get(a) ?? 0) + 1)
  }
  const total = answered.length
  const max = Math.max(0, ...counts.values())
  return (
    <div className="flex flex-col gap-[10px] mt-2">
      {q.options.map((opt) => {
        const count = counts.get(opt.id) ?? 0
        return (
          <DistRow
            key={opt.id}
            label={opt.text}
            count={count}
            total={total}
            highlight={count > 0 && count === max}
          />
        )
      })}
    </div>
  )
}

function YesNoDistribution({
  q,
  answered,
}: {
  q: { id: string }
  answered: ResponseRow[]
}) {
  let yes = 0
  let no = 0
  for (const r of answered) {
    const a = (r as any).answers?.[q.id]
    if (a === "yes") yes++
    else if (a === "no") no++
  }
  const total = answered.length
  const winner = yes === no ? "tie" : yes > no ? "yes" : "no"
  return (
    <div className="flex flex-col gap-[10px] mt-2">
      <DistRow label="Yes" count={yes} total={total} highlight={winner === "yes"} />
      <DistRow label="No" count={no} total={total} highlight={winner === "no"} />
    </div>
  )
}

function ScaleDistribution({
  q,
  answered,
}: {
  q: { id: string; min_label: string; max_label: string }
  answered: ResponseRow[]
}) {
  const buckets = [0, 0, 0, 0, 0]
  let sum = 0
  let n = 0
  for (const r of answered) {
    const a = (r as any).answers?.[q.id]
    if (typeof a === "number" && a >= 1 && a <= 5) {
      buckets[a - 1]++
      sum += a
      n++
    }
  }
  const mean = n ? (sum / n).toFixed(1) : "—"
  const max = Math.max(0, ...buckets)
  return (
    <div className="flex flex-col gap-[10px] mt-2">
      <div className="pl-[34px] flex justify-between text-[12.5px] text-[var(--muted-fg)] font-mono">
        <span>{q.min_label}</span>
        <span>Avg {mean} / 5</span>
        <span>{q.max_label}</span>
      </div>
      <div className="pl-[34px] flex gap-[6px] items-end h-[52px]">
        {buckets.map((count, i) => {
          const h = max > 0 ? (count / max) * 100 : 0
          const isPeak = count > 0 && count === max
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-[4px]">
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: `${Math.max(h, 4)}%`,
                  background: isPeak ? "var(--olive)" : "#b5c29a",
                  minHeight: count > 0 ? "4px" : "2px",
                  opacity: count > 0 ? 1 : 0.4,
                }}
              />
              <div className="text-[10.5px] font-mono text-[var(--muted-fg)]">{i + 1}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FreeTextSample({ answered, qid }: { answered: ResponseRow[]; qid: string }) {
  const samples = answered
    .map((r) => (r as any).answers?.[qid])
    .filter((a: any) => typeof a === "string" && a.trim().length > 0)
    .slice(0, 3)

  if (samples.length === 0) {
    return (
      <div className="text-[12.5px] text-[var(--faint)] italic pl-[34px]">
        No written answers yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 pl-[34px]">
      {samples.map((s: string, i: number) => (
        <div
          key={i}
          className="text-[13px] text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] rounded-[7px] px-3 py-[8px] leading-[1.4]"
        >
          &ldquo;{s.length > 240 ? s.slice(0, 237) + "…" : s}&rdquo;
        </div>
      ))}
    </div>
  )
}
