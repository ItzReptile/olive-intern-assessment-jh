import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import {
  LLMQuizSchema,
  QuizSpecSchema,
  computeRanges,
} from "@/lib/quiz-schema"
import { QUIZ_PATCH_PROMPT } from "@/prompts/quiz-generation"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MODEL = "claude-haiku-4-5-20251001"

// Reuse the same summarizer shape as the generate route.
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

type PatchMeta = { attempts: number; salvaged: boolean }

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

// Current stored spec includes `range` on results. Strip it before sending to
// the LLM — under structured outputs the model shouldn't see fields it's not
// supposed to emit, otherwise it can get confused and try to preserve them.
function stripRanges(spec: any) {
  return {
    ...spec,
    results: (spec.results ?? []).map(({ range, ...rest }: any) => rest),
  }
}

async function patchQuizSpec(
  originalPrompt: string,
  currentSpec: any,
  feedback: string,
  attempt = 1,
  previousSummary?: string,
  meta: PatchMeta = { attempts: 0, salvaged: false }
): Promise<{ spec: any; meta: PatchMeta }> {
  if (attempt > 2) {
    throw new Error("Failed to patch quiz after 2 attempts")
  }
  meta.attempts = attempt

  const base = `Original prompt: ${originalPrompt}\n\nCurrent spec: ${JSON.stringify(stripRanges(currentSpec))}\n\nUser feedback: ${feedback}`
  const userContent = previousSummary
    ? `${base}\n\nNote: your previous attempt had these issues — ${previousSummary}. Fix those specifically.`
    : base

  const response = await callLLMWithRetry(() =>
    anthropic.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      // Cache the patch system prompt — creators often iterate multiple
      // patches in the same session, so this is a real cost + latency win.
      system: [
        {
          type: "text",
          text: QUIZ_PATCH_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
      output_config: { format: zodOutputFormat(LLMQuizSchema) },
    })
  )

  const llmSpec = response.parsed_output
  if (!llmSpec) {
    return patchQuizSpec(
      originalPrompt,
      currentSpec,
      feedback,
      attempt + 1,
      "the previous response was empty or refused",
      meta
    )
  }

  const withRanges = computeRanges(llmSpec)
  try {
    const spec = QuizSpecSchema.parse(withRanges)
    return { spec, meta }
  } catch (err: any) {
    const summary = summarizeValidationError(err)
    return patchQuizSpec(originalPrompt, currentSpec, feedback, attempt + 1, summary, meta)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { quiz_id, feedback } = await req.json()

    if (!quiz_id || typeof quiz_id !== "string") {
      return NextResponse.json({ error: "quiz_id is required" }, { status: 400 })
    }
    if (!feedback || typeof feedback !== "string" || feedback.trim().length < 3) {
      return NextResponse.json(
        { error: "feedback must be at least 3 characters" },
        { status: 400 }
      )
    }

    const { data: quiz, error: fetchError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", quiz_id)
      .single()

    if (fetchError) throw fetchError

    const patchStart = Date.now()
    let validated: any
    let patchMeta: PatchMeta
    try {
      const result = await patchQuizSpec(quiz.prompt, quiz.spec, feedback)
      validated = result.spec
      patchMeta = result.meta
    } catch (err: any) {
      return NextResponse.json(
        {
          error: "patch_failed",
          message:
            "We couldn't apply that change after a few attempts. Try rephrasing your feedback more specifically.",
        },
        { status: 500 }
      )
    }

    // Snapshot the outgoing version AND update the quiz in parallel — the
    // snapshot doesn't depend on the update finishing, so there's no reason
    // to serialize them.
    const nextVersion = (quiz.version ?? 1) + 1
    const [snapshotRes, updateRes] = await Promise.all([
      supabase.from("quiz_versions").insert({
        quiz_id,
        version: quiz.version ?? 1,
        title: quiz.title,
        description: quiz.description,
        spec: quiz.spec,
      }),
      supabase
        .from("quizzes")
        .update({
          spec: validated,
          title: validated.title,
          description: validated.description,
          version: nextVersion,
        })
        .eq("id", quiz_id)
        .select()
        .single(),
    ])

    if (snapshotRes.error) throw snapshotRes.error
    if (updateRes.error) throw updateRes.error

    return NextResponse.json({
      quiz: updateRes.data,
      _meta: { ...patchMeta, ms: Date.now() - patchStart },
    })
  } catch (err: any) {
    console.error("patch route error:", err)
    return NextResponse.json({ error: err.message ?? "Unexpected error" }, { status: 500 })
  }
}
