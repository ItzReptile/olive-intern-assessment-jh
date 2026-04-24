import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Look up the current version so this response is attributed to the
    // spec the respondent actually sees. This is the only extra query — the
    // version is small and the lookup is indexed on id.
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
        answers: {},
        score: 0,
        result_title: "",
        started_at: new Date().toISOString(),
        completed_at: null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ response_id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
