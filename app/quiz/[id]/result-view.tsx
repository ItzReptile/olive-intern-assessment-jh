"use client"

import { useMemo } from "react"
import type { Question, QuizSpec } from "@/lib/quiz-schema"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MicroLabel } from "@/components/ui/typography"
import { cn } from "@/lib/utils"

// Shared shape — keep in sync with the caller in page.tsx.
export type Quiz = { id: string; title: string; description: string; spec: QuizSpec }
export type ResultData = {
  title: string
  description: string
  score: number
  maxScore: number
  cta: { text: string; url: string }
}

function slugFromId(id: string, title: string) {
  const clean = (title || "quiz")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16)
  return `${clean}-${id.slice(0, 4)}`
}

function formatAnswer(q: Question, raw: any): string {
  if (raw === undefined || raw === null || raw === "") return "— skipped —"
  if (q.type === "multiple-choice") {
    const opt = q.options.find((o) => o.id === raw)
    return opt?.text ?? String(raw)
  }
  if (q.type === "yes-no") {
    if (raw === "yes") return "Yes"
    if (raw === "no") return "No"
    return String(raw)
  }
  if (q.type === "scale") {
    const val = typeof raw === "number" ? raw : 0
    return `${val} / 5 · ${val <= 1 ? q.min_label : val >= 5 ? q.max_label : ""}`.trim()
  }
  return String(raw)
}

export function ResultView({
  quiz,
  result,
  answers,
  isCreator,
  onRetake,
  onCopy,
}: {
  quiz: Quiz
  result: ResultData
  answers: Record<string, any>
  isCreator: boolean
  onRetake: () => void
  onCopy: () => void
}) {
  const url = useMemo(() => {
    const slug = slugFromId(quiz.id, quiz.title)
    if (typeof window !== "undefined") return `${window.location.host}/q/${slug}`
    return `textoquiz.app/q/${slug}`
  }, [quiz.id, quiz.title])

  const titleSizeClass =
    result.title.length > 18
      ? "text-[30px] md:text-[40px]"
      : result.title.length > 12
      ? "text-[36px] md:text-[52px]"
      : "text-[44px] md:text-[64px]"

  return (
    <div className="flex-1 pb-10">
      <div className="mx-auto max-w-[640px] px-5 md:px-10 pt-10 md:pt-14">
        {/* Shareable card */}
        <Card padding={0} className="overflow-hidden shadow-result">
          <div
            className="text-center border-b border-[var(--border)] px-6 md:px-14 pt-8 md:pt-11 pb-6 md:pb-9"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at top, rgba(107,142,78,0.06), rgba(107,142,78,0) 60%)",
            }}
          >
            <MicroLabel className="!text-[var(--olive-dark)]">
              Olive · {quiz.title}
            </MicroLabel>
            <h1
              className={cn(
                "font-serif font-normal leading-[1.05] tracking-[-0.03em] text-[var(--foreground)]",
                titleSizeClass
              )}
              style={{ margin: "16px 0 10px", textWrap: "balance" as any }}
            >
              <em className="italic">{result.title}</em>
            </h1>
            <p
              className="text-[14px] md:text-[15.5px] leading-[1.55] text-[var(--muted-fg)] max-w-[440px] mx-auto"
              style={{ textWrap: "pretty" as any }}
            >
              {result.description}
            </p>
          </div>
          <div className="px-5 md:px-10 py-5 md:py-[26px] text-center">
            <MicroLabel>Score</MicroLabel>
            <div className="mt-[6px] font-mono tracking-[-0.02em] text-[28px] md:text-[32px] text-[var(--foreground)]">
              {result.score}
              <span className="text-[var(--faint)]">/{result.maxScore}</span>
            </div>
          </div>
          <div className="flex justify-between items-center border-t border-[var(--border)] bg-[var(--background)] px-5 md:px-10 py-3 md:py-[14px]">
            <span className="font-mono text-[11.5px] text-[var(--faint)] tracking-[-0.01em]">
              {url}
            </span>
          </div>
        </Card>

        {/* CTA row */}
        <div className="mt-7 flex flex-col md:flex-row gap-[10px] md:justify-center md:items-center">
          <a href={result.cta.url} className="block md:inline-block">
            <Button size="lg" className="w-full md:w-auto">
              {result.cta.text || "See what fits you"}
            </Button>
          </a>
          <div className="grid grid-cols-2 md:flex gap-2">
            <Button size="lg" variant="secondary" className="w-full md:w-auto" onClick={onRetake}>
              Retake
            </Button>
            <Button size="lg" variant="secondary" className="w-full md:w-auto" onClick={onCopy}>
              Copy link
            </Button>
          </div>
        </div>

        {/* Creator shortcut to dashboard */}
        {isCreator && (
          <div className="mt-5 flex justify-center">
            <a
              href={`/dashboard/${quiz.id}`}
              className="inline-flex items-center gap-[6px] text-[13px] text-[var(--olive-dark)] hover:underline underline-offset-4 decoration-[var(--olive-tint-border)]"
            >
              See responses & stats →
            </a>
          </div>
        )}

        {/* Your answers */}
        <div className="mt-10 md:mt-14">
          <MicroLabel className="block mb-[14px]">Your answers</MicroLabel>
          <Card padding={0} className="overflow-hidden">
            {quiz.spec.questions.map((q, i) => (
              <div
                key={q.id}
                className={`px-5 md:px-6 py-4 ${
                  i < quiz.spec.questions.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] text-[var(--faint)] min-w-[18px]">
                    Q{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-[var(--muted-fg)] leading-[1.45] mb-[6px]">
                      {q.question}
                    </div>
                    <div
                      className={`text-[14.5px] leading-[1.45] ${
                        answers[q.id] === undefined || answers[q.id] === ""
                          ? "text-[var(--faint)] italic"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {formatAnswer(q, answers[q.id])}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>

      </div>
    </div>
  )
}
