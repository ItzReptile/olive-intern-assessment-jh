import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import {
  LLMQuizSchema,
  QuizSpecSchema,
  computeRanges,
} from "@/lib/quiz-schema"
import { QUIZ_GENERATION_PROMPT, QUIZ_SCREENER_PROMPT } from "@/prompts/quiz-generation"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MODEL = "claude-haiku-4-5-20251001"

/* ─────────── Layer 1: hardcoded input guards ─────────── */

const MIN_LEN = 10
const MAX_LEN = 500
const MIN_LETTER_RATIO = 0.3

type GuardReject = { reason: string; message: string }

function runInputGuards(prompt: string): GuardReject | null {
  const trimmed = prompt.trim()

  if (trimmed.length < MIN_LEN) {
    return {
      reason: "too_short",
      message: `Describe your quiz in at least ${MIN_LEN} characters — a sentence or two works great.`,
    }
  }
  if (trimmed.length > MAX_LEN) {
    return {
      reason: "too_long",
      message: `Keep your description under ${MAX_LEN} characters. Trim to the essentials.`,
    }
  }

  const letters = (trimmed.match(/[\p{L}\p{N}]/gu) ?? []).length
  const ratio = letters / trimmed.length
  if (ratio < MIN_LETTER_RATIO) {
    return {
      reason: "gibberish",
      message: "Your description looks mostly like symbols. Try writing a sentence that describes the quiz you want.",
    }
  }

  return null
}

/* ─────────── Layer 2: LLM screener ─────────── */

type ScreenerVerdict =
  | "valid"
  | "too_vague"
  | "off_topic"
  | "harmful"
  | "injection_attempt"
  | "needs_clarification"

type ScreenerResult = {
  verdict: ScreenerVerdict
  reason: string
  language?: string
  questions?: { q: string; options: string[] }[]
}

async function screenPrompt(prompt: string): Promise<ScreenerResult> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    // The screener system prompt is stable across all requests, so mark it
    // cacheable. Subsequent calls within the 5-minute cache window hit at
    // ~10% of full input token cost with much lower latency.
    system: [
      {
        type: "text",
        text: QUIZ_SCREENER_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  })

  const raw = response.content[0].type === "text" ? response.content[0].text : ""
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  const parsed = JSON.parse(cleaned)

  if (!parsed || typeof parsed.verdict !== "string") {
    throw new Error("Screener returned malformed output")
  }
  return parsed as ScreenerResult
}

const VERDICT_MESSAGES: Record<Exclude<ScreenerVerdict, "valid" | "needs_clarification">, string> = {
  too_vague: "That prompt is too short or vague to generate a quiz from. Try describing what the quiz is about, who it's for, and what the results should say.",
  off_topic: "That doesn't look like a quiz description. Tell us what you want the quiz to measure or reveal.",
  harmful: "We can't generate a quiz on that topic. Try a different subject.",
  injection_attempt: "That prompt looks like a system manipulation attempt. Try describing an actual quiz you want to build.",
}

/* ─────────── Layer 3-5: generate with retry ─────────── */

// Extract clean, human-readable messages from a ZodError. Default .message is
// a verbose JSON dump — giving that back to the LLM buries the real issue.
function summarizeValidationError(err: any): string {
  if (err?.issues && Array.isArray(err.issues)) {
    return err.issues
      .map((i: any) => {
        const path = Array.isArray(i.path) && i.path.length ? i.path.join(".") : ""
        return path ? `${path}: ${i.message}` : i.message
      })
      .join("; ")
  }
  if (err instanceof SyntaxError) return `JSON parse error: ${err.message}`
  return String(err?.message ?? err)
}

type GenMeta = { attempts: number; salvaged: boolean }

// Transient Anthropic errors (rate limit / 5xx / network blips) shouldn't
// bubble straight to the user. Retry with a short exponential backoff.
async function callLLMWithRetry<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  let lastErr: any
  for (let i = 0; i < max; i++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const status = err?.status ?? err?.response?.status
      const transient = status === 429 || (status >= 500 && status < 600) || !status
      if (!transient) throw err
      await new Promise((r) => setTimeout(r, 300 * Math.pow(2, i)))
    }
  }
  throw lastErr
}

/* ─────────────────────────────────────────────────────────────
 * Generate via structured outputs.
 *
 * Structured outputs enforce shape/types/required fields at the
 * decoder level — the LLM physically cannot emit malformed JSON.
 * That removes the main source of attempt-1 failures.
 *
 * Range arithmetic is done server-side in computeRanges() — the
 * LLM never writes numeric ranges, so it can't get them wrong.
 *
 * Retry loop is kept small (max 2) for the rare case a numeric
 * bound fails Zod (e.g. option score > 5 or a weight > 3 slipping
 * past the prompt). ──────────────────────────────────────────── */
async function generateQuizSpec(
  prompt: string,
  attempt = 1,
  previousSummary?: string,
  meta: GenMeta = { attempts: 0, salvaged: false }
): Promise<{ spec: any; meta: GenMeta }> {
  if (attempt > 2) {
    throw new Error("Failed to generate a valid quiz after 2 attempts")
  }
  meta.attempts = attempt

  const userContent = previousSummary
    ? `${prompt}\n\nNote: your previous attempt had these issues — ${previousSummary}. Fix those specifically.`
    : prompt

  const response = await callLLMWithRetry(() =>
    anthropic.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      // Cache the generation system prompt — it's stable across every call,
      // so back-to-back generations pay ~10% of full input cost for it.
      system: [
        {
          type: "text",
          text: QUIZ_GENERATION_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
      output_config: { format: zodOutputFormat(LLMQuizSchema) },
    })
  )

  const llmSpec = response.parsed_output
  if (!llmSpec) {
    // Refusal or truncation. Retry once.
    return generateQuizSpec(prompt, attempt + 1, "the previous response was empty or refused", meta)
  }

  const withRanges = computeRanges(llmSpec)
  try {
    const spec = QuizSpecSchema.parse(withRanges)
    return { spec, meta }
  } catch (err: any) {
    const summary = summarizeValidationError(err)
    return generateQuizSpec(prompt, attempt + 1, summary, meta)
  }
}

/* ─────────── Route handler ─────────── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rawPrompt = body?.prompt
    const clarified: boolean = body?.clarified === true

    if (!rawPrompt || typeof rawPrompt !== "string") {
      return NextResponse.json(
        { error: "invalid_input", message: "Prompt is required." },
        { status: 400 }
      )
    }

    // Layer 1 — hardcoded guards
    const guardFail = runInputGuards(rawPrompt)
    if (guardFail) {
      return NextResponse.json(
        { error: guardFail.reason, message: guardFail.message },
        { status: 400 }
      )
    }

    // Layer 2 — screener (skipped if user has already answered clarification)
    if (!clarified) {
      let screen: ScreenerResult
      try {
        screen = await screenPrompt(rawPrompt)
      } catch (err: any) {
        // Fail-closed: if screener itself fails, don't proceed to generation.
        return NextResponse.json(
          {
            error: "screener_unavailable",
            message: "We couldn't verify your prompt. Please try again in a moment.",
          },
          { status: 503 }
        )
      }

      if (screen.verdict === "needs_clarification") {
        return NextResponse.json(
          {
            kind: "clarification",
            questions: screen.questions ?? [],
            language: screen.language,
          },
          { status: 200 }
        )
      }

      if (screen.verdict !== "valid") {
        const message =
          VERDICT_MESSAGES[screen.verdict as keyof typeof VERDICT_MESSAGES] ??
          "That prompt couldn't be used."
        return NextResponse.json(
          { error: screen.verdict, message, reason: screen.reason, language: screen.language },
          { status: 422 }
        )
      }
      // verdict === "valid" → fall through to generation
    }

    // Layer 3-5 — generate + validate + retry
    const genStart = Date.now()
    let spec: any
    let genMeta: GenMeta
    try {
      const result = await generateQuizSpec(rawPrompt)
      spec = result.spec
      genMeta = result.meta
    } catch (err: any) {
      return NextResponse.json(
        {
          error: "generation_failed",
          message: "We couldn't generate a valid quiz after a few attempts. Try rephrasing your prompt.",
        },
        { status: 500 }
      )
    }

    const { data, error: dbError } = await supabase
      .from("quizzes")
      .insert({
        title: spec.title,
        description: spec.description,
        prompt: rawPrompt,
        spec,
      })
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json({
      kind: "quiz",
      quiz: data,
      _meta: { ...genMeta, ms: Date.now() - genStart },
    })
  } catch (err: any) {
    console.error("generate route error:", err)
    return NextResponse.json(
      { error: "server_error", message: err.message ?? "Unexpected error." },
      { status: 500 }
    )
  }
}
