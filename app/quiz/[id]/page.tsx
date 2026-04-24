"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import type { QuizSpec, Question } from "@/lib/quiz-schema"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { MicroLabel, MonoURL } from "@/components/ui/typography"
import { ErrorLine } from "@/components/ui/error-line"
import { Nav } from "@/components/nav"
import { Spinner } from "@/components/ui/spinner"
import { Toast } from "@/components/ui/toast"
import type { Quiz, ResultData } from "./result-view"

// Lazy-load the result screen. During the quiz flow itself (most of the user's
// time on this page) we don't need the result-view bundle in memory.
const ResultView = dynamic(
  () => import("./result-view").then((m) => m.ResultView),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="inline-flex items-center gap-2 text-[var(--muted-fg)]">
          <Spinner /> Preparing your result…
        </div>
      </div>
    ),
  }
)

function computeMaxScore(spec: QuizSpec) {
  let total = 0
  for (const q of spec.questions) {
    if (q.type === "multiple-choice") {
      const max = Math.max(0, ...q.options.map((o) => o.score))
      total += max * q.weight
    } else if (q.type === "yes-no") {
      total += Math.max(q.yes_score, q.no_score) * q.weight
    } else if (q.type === "scale") {
      total += 5 * q.weight
    }
  }
  return total
}

function computeScore(spec: QuizSpec, answers: Record<string, any>) {
  let total = 0
  for (const q of spec.questions) {
    const a = answers[q.id]
    if (q.type === "multiple-choice") {
      const opt = q.options.find((o) => o.id === a)
      total += (opt?.score ?? 0) * q.weight
    } else if (q.type === "yes-no") {
      if (a === "yes") total += q.yes_score * q.weight
      else if (a === "no") total += q.no_score * q.weight
    } else if (q.type === "scale") {
      const raw = typeof a === "number" ? a : 0
      const val = q.invert && raw > 0 ? 6 - raw : raw
      total += val * q.weight
    }
  }
  return total
}

export default function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [fetchError, setFetchError] = useState("")
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [startedAt] = useState(new Date().toISOString())
  const [result, setResult] = useState<ResultData | null>(null)

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const [direction, setDirection] = useState<"forward" | "back">("forward")
  const [animKey, setAnimKey] = useState(0)
  const [isCreator, setIsCreator] = useState(false)
  const responseIdRef = useRef<string | null>(null)
  const startPendingRef = useRef<boolean>(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/quiz/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.error) setFetchError(d.error)
        else setQuiz(d.quiz)
      })
      .catch((err) => !cancelled && setFetchError(err.message))
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (typeof window === "undefined" || !id) return
    try {
      const raw = window.localStorage.getItem("createdQuizzes")
      const list: string[] = raw ? JSON.parse(raw) : []
      setIsCreator(list.includes(id as string))
    } catch {
      setIsCreator(false)
    }
  }, [id])

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    []
  )

  function flashToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }

  if (fetchError) {
    return (
      <main className="min-h-screen flex flex-col">
        <Nav className="hidden md:flex" />
        <Nav mobile className="flex md:hidden" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full">
            <ErrorLine>We couldn&apos;t load this quiz — {fetchError}</ErrorLine>
          </div>
        </div>
      </main>
    )
  }

  if (!quiz) {
    return (
      <main className="min-h-screen flex flex-col">
        <Nav className="hidden md:flex" />
        <Nav mobile className="flex md:hidden" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="inline-flex items-center gap-2 text-[var(--muted-fg)]">
            <Spinner /> Loading quiz…
          </div>
        </div>
      </main>
    )
  }

  const spec = quiz.spec
  const questions = spec.questions
  const maxScore = computeMaxScore(spec)
  const question = questions[current] as Question
  const answer = answers[question.id]

  const canAdvance =
    question.type === "free-text" ? true : answer !== undefined && answer !== null && answer !== ""
  const isLast = current === questions.length - 1
  const pct = ((current + 1) / questions.length) * 100

  async function ensureStartRecorded() {
    // Creator previews don't pollute stats.
    if (isCreator) return
    if (typeof window === "undefined") return
    if (responseIdRef.current || startPendingRef.current) return

    const storageKey = `quiz_response_${id}`
    const existing = window.sessionStorage.getItem(storageKey)
    if (existing) {
      responseIdRef.current = existing
      return
    }

    startPendingRef.current = true
    try {
      const res = await fetch(`/api/quiz/${id}/start`, { method: "POST" })
      const data = await res.json()
      if (res.ok && data.response_id) {
        responseIdRef.current = data.response_id
        window.sessionStorage.setItem(storageKey, data.response_id)
      }
    } catch {
      // Soft-fail: start tracking is a nice-to-have, not a blocker.
    } finally {
      startPendingRef.current = false
    }
  }

  function setAnswer(value: any) {
    setAnswers((prev) => ({ ...prev, [question.id]: value }))
    // Fire-and-forget on the first interaction. Subsequent calls bail early.
    void ensureStartRecorded()
  }

  function goNext() {
    if (!canAdvance) return
    if (isLast) {
      handleFinish()
      return
    }
    setDirection("forward")
    setAnimKey((k) => k + 1)
    setCurrent((c) => c + 1)
  }

  function goBack() {
    if (current === 0) return
    setDirection("back")
    setAnimKey((k) => k + 1)
    setCurrent((c) => c - 1)
  }

  async function handleFinish() {
    const score = computeScore(spec, answers)
    const matched =
      spec.results.find((r) => score >= r.range[0] && score <= r.range[1]) ??
      spec.results[spec.results.length - 1]

    const finalResult: ResultData = {
      title: matched.title,
      description: matched.description,
      cta: matched.cta,
      score,
      maxScore,
    }
    setResult(finalResult)

    if (isCreator) return // creator previews don't write to the responses table

    try {
      await fetch(`/api/quiz/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          score,
          result_title: matched.title,
          started_at: startedAt,
          response_id: responseIdRef.current,
        }),
      })

      // Clear the session handle so a Retake counts as a fresh start.
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`quiz_response_${id}`)
      }
      responseIdRef.current = null
    } catch {
      // best effort
    }
  }

  function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    navigator.clipboard.writeText(window.location.href)
    flashToast("Link copied")
  }

  function handleRetake() {
    setCurrent(0)
    setAnswers({})
    setResult(null)
  }

  /* ─── Result view ────────────────────────────────────────── */
  if (result) {
    return (
      <main className="min-h-screen flex flex-col">
        <Nav className="hidden md:flex" />
        <Nav mobile className="flex md:hidden" />
        <ResultView
          quiz={quiz}
          result={result}
          answers={answers}
          isCreator={isCreator}
          onRetake={handleRetake}
          onCopy={handleCopy}
        />
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <Toast>{toast}</Toast>
          </div>
        )}
      </main>
    )
  }

  /* ─── Quiz flow ──────────────────────────────────────────── */
  const typeLabels: Record<Question["type"], string> = {
    "multiple-choice": "Multiple choice · pick one",
    "yes-no": "Yes or No",
    scale: "Scale · 1 to 5",
    "free-text": "Free response",
  }

  return (
    <main className="min-h-screen flex flex-col">
      <Nav showDashboard={false} className="hidden md:flex" />
      <Nav mobile showDashboard={false} className="flex md:hidden" />

      {/* Header */}
      <div className="px-5 md:px-18 pt-5" style={{}}>
        <div className="mx-auto max-w-[1136px]">
          <div className="flex justify-between items-baseline mb-[14px]">
            <div className="font-serif italic text-[18px] md:text-[22px] text-[var(--foreground)] tracking-[-0.01em]">
              {quiz.title}
            </div>
            <MonoURL className="!text-[11px] md:!text-[12px]">
              <span className="hidden md:inline">Question </span>
              {current + 1}
              <span className="md:hidden">/</span>
              <span className="hidden md:inline"> of </span>
              {questions.length}
            </MonoURL>
          </div>
          <ProgressBar value={pct} />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 px-5 md:px-12 py-8 md:py-14">
        <div className="mx-auto max-w-[680px]">
          <div
            key={animKey}
            className={direction === "forward" ? "tq-slide-in" : "tq-slide-in"}
          >
            <Card padding={0}>
              <div className="p-6 md:p-9">
                <MicroLabel>{typeLabels[question.type]}</MicroLabel>
                <h2
                  className="font-serif text-[26px] md:text-[34px] font-normal leading-[1.15] tracking-[-0.02em] mt-3 mb-0 text-[var(--foreground)]"
                  style={{ textWrap: "balance" as any }}
                >
                  {question.question}
                </h2>
                {question.type === "free-text" && (
                  <p className="text-[13.5px] text-[var(--muted-fg)] mt-[10px] mb-0">
                    Skip it if you&apos;d rather — this one&apos;s optional.
                  </p>
                )}

                <div className="mt-6 md:mt-7">
                  {question.type === "multiple-choice" && (
                    <MultipleChoice
                      options={question.options}
                      value={answer}
                      onChange={setAnswer}
                    />
                  )}
                  {question.type === "yes-no" && (
                    <YesNo value={answer} onChange={setAnswer} />
                  )}
                  {question.type === "scale" && (
                    <Scale
                      value={answer}
                      min_label={question.min_label}
                      max_label={question.max_label}
                      onChange={setAnswer}
                    />
                  )}
                  {question.type === "free-text" && (
                    <FreeText value={answer ?? ""} onChange={setAnswer} />
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-between items-center mt-7 md:mt-10">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={current === 0}
              style={{ opacity: current === 0 ? 0.4 : 1 }}
            >
              ← Back
            </Button>
            <Button onClick={goNext} disabled={!canAdvance}>
              {isLast ? "See results →" : "Next →"}
            </Button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <Toast>{toast}</Toast>
        </div>
      )}
    </main>
  )
}

/* ─── Question-type renderers ──────────────────────────────── */
function MultipleChoice({
  options,
  value,
  onChange,
}: {
  options: { id: string; text: string; score: number }[]
  value: string | undefined
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-[10px]">
      {options.map((o, i) => {
        const selected = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-[14px] px-4 md:px-[18px] py-[13px] md:py-[15px] rounded-[9px] text-left transition-colors border ${
              selected
                ? "border-[var(--olive-tint-border)] bg-[var(--olive-tint)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
            }`}
          >
            <span
              className={`flex-shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border-[1.5px] ${
                selected
                  ? "border-[var(--olive-dark)] bg-[var(--olive)]"
                  : "border-[var(--border-strong)] bg-[var(--surface)]"
              }`}
            >
              {selected && <span className="w-[6px] h-[6px] rounded-full bg-white tq-bounce" />}
            </span>
            <span
              className={`font-mono text-[11px] w-4 ${
                selected ? "text-[var(--olive-dark)]" : "text-[var(--faint)]"
              }`}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className="text-[14.5px] md:text-[15px] text-[var(--foreground)]">
              {o.text}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function YesNo({
  value,
  onChange,
}: {
  value: "yes" | "no" | undefined
  onChange: (v: "yes" | "no") => void
}) {
  const Tile = ({ v, label, sub }: { v: "yes" | "no"; label: string; sub: string }) => {
    const selected = value === v
    return (
      <button
        type="button"
        onClick={() => onChange(v)}
        className={`flex-1 relative rounded-[10px] border transition-colors py-[26px] md:py-[42px] px-4 md:px-6 text-center ${
          selected
            ? "border-[var(--olive-tint-border)] bg-[var(--olive-tint)]"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
        }`}
      >
        {selected && (
          <span className="absolute top-3 right-3 w-[18px] h-[18px] rounded-full bg-[var(--olive)] text-white inline-flex items-center justify-center text-[10px] font-bold tq-bounce">
            ✓
          </span>
        )}
        <div
          className={`font-serif tracking-[-0.03em] leading-none text-[34px] md:text-[48px] ${
            selected ? "text-[var(--olive-dark)]" : "text-[var(--foreground)]"
          }`}
        >
          {label}
        </div>
        <div
          className={`mt-3 text-[12.5px] font-mono ${
            selected ? "text-[var(--olive-dark)]" : "text-[var(--muted-fg)]"
          }`}
        >
          {sub}
        </div>
      </button>
    )
  }
  return (
    <div className="flex gap-3 mt-1">
      <Tile v="yes" label="Yes" sub="Y · 1" />
      <Tile v="no" label="No" sub="N · 2" />
    </div>
  )
}

function Scale({
  value,
  min_label,
  max_label,
  onChange,
}: {
  value: number | undefined
  min_label: string
  max_label: string
  onChange: (v: number) => void
}) {
  return (
    <>
      <div className="flex gap-2 md:gap-3 mt-[6px]">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = n === value
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`flex-1 aspect-square flex items-center justify-center rounded-[10px] border transition-colors font-serif tracking-[-0.02em] text-[26px] md:text-[32px] ${
                selected
                  ? "border-[var(--olive-tint-border)] bg-[var(--olive-tint)] text-[var(--olive-dark)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--border-strong)]"
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between mt-[14px] text-[12px] text-[var(--muted-fg)] font-mono">
        <span>{min_label}</span>
        <span>{max_label}</span>
      </div>
    </>
  )
}

function FreeText({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const max = 280
  return (
    <>
      <textarea
        className="tq-ta"
        placeholder="Type your answer…"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        style={{ minHeight: 140, fontSize: 15, lineHeight: 1.55 }}
      />
      <div className="flex justify-between items-center mt-[10px]">
        <MonoURL className="!text-[11px]">Optional</MonoURL>
        <MonoURL className="!text-[11px]">
          {value.length} / {max}
        </MonoURL>
      </div>
    </>
  )
}
