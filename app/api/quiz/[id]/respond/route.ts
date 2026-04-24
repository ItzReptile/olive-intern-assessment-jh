import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { answers, score, result_title, started_at, response_id } = await req.json()
    const completed_at = new Date().toISOString()

    // If the client tracked a "start" row for this attempt, update it.
    // Otherwise fall back to a one-shot insert (backward-compatible).
    if (response_id) {
      // The row already exists from /start — version was stamped at start.
      // Don't touch it; the respondent is completing the same spec.
      const { data, error } = await supabase
        .from("responses")
        .update({ answers, score, result_title, completed_at })
        .eq("id", response_id)
        .eq("quiz_id", id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ response: data })
    }

    // One-shot path (no prior /start call) — look up current version inline.
    const { data: quiz, error: versionErr } = await supabase
      .from("quizzes")
      .select("version")
      .eq("id", id)
      .single()
    if (versionErr) throw versionErr

    const { data, error } = await supabase
      .from("responses")
      .insert({
        quiz_id: id,
        version: quiz.version ?? 1,
        answers,
        score,
        result_title,
        started_at,
        completed_at,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ response: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
