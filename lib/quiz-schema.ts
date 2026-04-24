import { z } from "zod"

/* ─────────────────────────────────────────────────────────────────────
 * Two schemas:
 *
 *  - LLMQuizSchema       → what the model outputs via structured outputs.
 *                          No result ranges, no numeric bounds (structured
 *                          outputs can't enforce numeric constraints, and
 *                          range math is something the LLM gets wrong —
 *                          we compute it server-side instead).
 *
 *  - QuizSpecSchema      → what we store and render. Ranges + bounds.
 *                          Derived from LLM output via computeRanges().
 *
 * Structured outputs guarantee shape/types/required fields; Zod still
 * validates numeric bounds on the final QuizSpec as defense in depth.
 * ──────────────────────────────────────────────────────────────────── */

const OptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  score: z.number().int().min(0).max(5),
})

const QuestionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("multiple-choice"),
    question: z.string(),
    weight: z.number().min(1).max(3),
    options: z.array(OptionSchema).min(2).max(6),
  }),
  z.object({
    id: z.string(),
    type: z.literal("yes-no"),
    question: z.string(),
    weight: z.number().min(1).max(3),
    yes_score: z.number().int().min(0).max(5),
    no_score: z.number().int().min(0).max(5),
  }),
  z.object({
    id: z.string(),
    type: z.literal("scale"),
    question: z.string(),
    weight: z.number().min(1).max(3),
    min_label: z.string(),
    max_label: z.string(),
    invert: z.boolean().default(false),
  }),
  z.object({
    id: z.string(),
    type: z.literal("free-text"),
    question: z.string(),
    weight: z.literal(1),
  }),
])

const ResultSchema = z.object({
  range: z.tuple([z.number(), z.number()]),
  title: z.string(),
  description: z.string(),
  cta: z.object({
    text: z.string(),
    url: z.string(),
  }),
})

// Shape-only schema — same fields, no range-math refinement. Used as the
// base for QuizSpecSchema and as the return type of computeRanges().
export const QuizSpecShape = z.object({
  title: z.string(),
  description: z.string(),
  questions: z.array(QuestionSchema).min(5).max(8),
  results: z.array(ResultSchema).min(2).max(5),
})

export const QuizSpecSchema = QuizSpecShape
  .superRefine((spec, ctx) => {
    // ── Compute the real max possible score ──
    let maxScore = 0
    for (const q of spec.questions) {
      if (q.type === "multiple-choice") {
        maxScore += Math.max(0, ...q.options.map((o) => o.score)) * q.weight
      } else if (q.type === "yes-no") {
        maxScore += Math.max(q.yes_score, q.no_score) * q.weight
      } else if (q.type === "scale") {
        maxScore += 5 * q.weight
      }
    }

    // Sort by range start for the checks below
    const sorted = [...spec.results].sort((a, b) => a.range[0] - b.range[0])

    // ── Bottom must start at 0 ──
    if (sorted[0].range[0] !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["results"],
        message: `First result range must start at 0, but got ${sorted[0].range[0]}. Rewrite ranges so the lowest range begins at 0.`,
      })
    }

    // ── Top must cover max possible score ──
    const top = sorted[sorted.length - 1]
    if (top.range[1] < maxScore) {
      ctx.addIssue({
        code: "custom",
        path: ["results"],
        message: `Top result range ends at ${top.range[1]} but the max possible score is ${maxScore}. Rewrite ranges so the top range ends at ${maxScore} (extend the top tier upward).`,
      })
    }

    // ── Contiguous: no gaps, no overlaps ──
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const cur = sorted[i]
      if (cur.range[0] !== prev.range[1] + 1) {
        ctx.addIssue({
          code: "custom",
          path: ["results"],
          message: `Result ranges must be contiguous with no gaps or overlaps. Range ${i} starts at ${cur.range[0]} but the previous range ended at ${prev.range[1]} (expected ${prev.range[1] + 1}).`,
        })
      }
    }

    // ── Each range must be valid (low <= high) ──
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].range[0] > sorted[i].range[1]) {
        ctx.addIssue({
          code: "custom",
          path: ["results"],
          message: `Result range ${i} is inverted: [${sorted[i].range[0]}, ${sorted[i].range[1]}].`,
        })
      }
    }
  })

export type QuizSpec = z.infer<typeof QuizSpecSchema>
export type Question = z.infer<typeof QuestionSchema>
export type Result = z.infer<typeof ResultSchema>

/* ─────────── LLM-facing schema ───────────
 * Same content as QuizSpecShape, but:
 *   - results have no `range` — the LLM never writes numeric ranges,
 *     so it can't get them wrong. Server computes them in computeRanges()
 *     based on the actual MAX_SCORE from the questions.
 *   - no numeric/array bound constraints — Anthropic structured outputs
 *     can't enforce minimum/maximum or minItems>1 at the decoder level.
 *     QuizSpecSchema re-checks those bounds after computeRanges() runs.
 */

const LLMOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  score: z.number(),
})

const LLMQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("multiple-choice"),
    question: z.string(),
    weight: z.number(),
    options: z.array(LLMOptionSchema),
  }),
  z.object({
    id: z.string(),
    type: z.literal("yes-no"),
    question: z.string(),
    weight: z.number(),
    yes_score: z.number(),
    no_score: z.number(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("scale"),
    question: z.string(),
    weight: z.number(),
    min_label: z.string(),
    max_label: z.string(),
    invert: z.boolean(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("free-text"),
    question: z.string(),
    weight: z.number(),
  }),
])

const LLMResultSchema = z.object({
  title: z.string(),
  description: z.string(),
  cta: z.object({
    text: z.string(),
    url: z.string(),
  }),
})

export const LLMQuizSchema = z.object({
  title: z.string(),
  description: z.string(),
  questions: z.array(LLMQuestionSchema),
  results: z.array(LLMResultSchema),
})

export type LLMQuizSpec = z.infer<typeof LLMQuizSchema>

/**
 * Transform LLM output into a full QuizSpec. Computes MAX_SCORE from the
 * question weights/scoring, then distributes the score space evenly across
 * the LLM's result tiers (preserving tier order). This is the core of the
 * reliability strategy — the LLM never does arithmetic, so range math can
 * never be wrong.
 */
export function computeRanges(llm: LLMQuizSpec): z.infer<typeof QuizSpecShape> {
  let maxScore = 0
  for (const q of llm.questions) {
    if (q.type === "multiple-choice") {
      maxScore += Math.max(0, ...q.options.map((o) => o.score)) * q.weight
    } else if (q.type === "yes-no") {
      maxScore += Math.max(q.yes_score, q.no_score) * q.weight
    } else if (q.type === "scale") {
      maxScore += 5 * q.weight
    }
  }

  const n = llm.results.length
  const totalSlots = maxScore + 1
  const baseSize = Math.floor(totalSlots / n)
  const remainder = totalSlots % n

  let cursor = 0
  const results = llm.results.map((r, i) => {
    const size = baseSize + (i < remainder ? 1 : 0)
    const start = cursor
    const end = cursor + size - 1
    cursor = end + 1
    return { ...r, range: [start, end] as [number, number] }
  })

  // LLMQuizSchema types free-text weight as `number`, but QuizSpecShape pins
  // it to the literal 1 (weight doesn't affect scoring for free-text). Coerce
  // here so the output satisfies the stored schema and the later Zod parse
  // won't trip on a legitimate case.
  const questions = llm.questions.map((q) =>
    q.type === "free-text" ? { ...q, weight: 1 as const } : q
  )

  return { ...llm, questions, results }
}

