"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MicroLabel } from "@/components/ui/typography"
import { Pill } from "@/components/ui/pill"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export type ClarificationQuestion = {
  q: string
  options: string[]
}

type AnswerState = Record<number, { picked?: string; custom?: string }>

type Props = {
  originalPrompt: string
  questions: ClarificationQuestion[]
  language?: string
  loading: boolean
  onSubmit: (enrichedPrompt: string) => void
  onSkip: () => void
  onBack: () => void
}

export function ClarificationPanel({
  originalPrompt,
  questions,
  language,
  loading,
  onSubmit,
  onSkip,
  onBack,
}: Props) {
  const [answers, setAnswers] = useState<AnswerState>({})

  const hasAnyAnswer = Object.values(answers).some(
    (a) => (a?.picked && a.picked.length > 0) || (a?.custom && a.custom.trim().length > 0)
  )

  function buildEnrichedPrompt() {
    const additions: string[] = []
    questions.forEach((q, i) => {
      const a = answers[i]
      if (!a) return
      const answer = a.custom?.trim() || a.picked
      if (answer) {
        additions.push(`${q.q} ${answer}`)
      }
    })
    if (additions.length === 0) return originalPrompt
    return `${originalPrompt.trim()}\n\nAdditional context:\n- ${additions.join("\n- ")}`
  }

  const showLanguageNote = language && language !== "en"

  return (
    <Card padding={0} className="overflow-hidden">
      <div className="flex justify-between items-center px-5 py-[14px] border-b border-[var(--border)]">
        <MicroLabel>A few quick questions</MicroLabel>
        <button
          type="button"
          onClick={onBack}
          className="text-[12px] text-[var(--muted-fg)] hover:text-[var(--foreground)] transition-colors"
        >
          ← Edit prompt
        </button>
      </div>
      <div className="p-5 space-y-6">
        <p className="text-[13.5px] text-[var(--muted-fg)] leading-[1.5] m-0">
          Your prompt is clear, but a little more context will make the quiz sharper. Pick an option or type your own — or skip to generate from the original prompt.
        </p>

        {showLanguageNote && (
          <div className="bg-[var(--olive-tint)] border border-[var(--olive-tint-border)] rounded-[7px] px-3 py-[9px] text-[12.5px] text-[var(--olive-dark)]">
            Detected language: <span className="font-mono uppercase">{language}</span>. The quiz will be generated in this language.
          </div>
        )}

        {questions.map((q, i) => {
          const a = answers[i] || {}
          return (
            <div key={i}>
              <div className="text-[14.5px] text-[var(--foreground)] font-medium mb-[10px]">
                {q.q}
              </div>
              <div className="flex flex-wrap gap-[7px] mb-[10px]">
                {q.options.map((opt) => {
                  const selected = a.picked === opt && !(a.custom && a.custom.trim())
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [i]: { picked: opt, custom: "" },
                        }))
                      }
                      className={cn(
                        "inline-flex items-center px-[11px] py-[5px] rounded-full text-[12.5px] font-medium tracking-[-0.005em] transition-colors border cursor-pointer",
                        selected
                          ? "bg-[var(--olive-tint)] text-[var(--olive-dark)] border-[var(--olive-tint-border)]"
                          : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
              <input
                className="tq-input"
                placeholder="Or type your own answer…"
                value={a.custom ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [i]: { picked: prev[i]?.picked, custom: e.target.value },
                  }))
                }
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between items-center px-5 py-[14px] bg-[var(--background)] border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onSkip}
          disabled={loading}
          className="text-[13px] text-[var(--muted-fg)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
        >
          Skip and generate anyway
        </button>
        <Button
          onClick={() => onSubmit(buildEnrichedPrompt())}
          disabled={loading || !hasAnyAnswer}
        >
          {loading ? (
            <>
              <Spinner size={14} /> Generating…
            </>
          ) : (
            "Generate with answers →"
          )}
        </Button>
      </div>
    </Card>
  )
}
