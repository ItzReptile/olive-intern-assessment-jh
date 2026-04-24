import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { QuizSpecSchema } from "@/lib/quiz-schema"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Manual edit endpoint — creator has adjusted questions / scores / tiers
 * themselves. No LLM involved. Same versioning semantics as /patch:
 * snapshot the outgoing spec, bump quiz.version.
 */
export async function POST(req: NextRequest) {
  try {
    const { quiz_id, spec } = await req.json()

    if (!quiz_id || typeof quiz_id !== "string") {
      return NextResponse.json({ error: "quiz_id is required" }, { status: 400 })
    }
    if (!spec || typeof spec !== "object") {
      return NextResponse.json({ error: "spec is required" }, { status: 400 })
    }

    // Validate the incoming spec. This is the final gate — structured outputs
    // don't apply here because the client sent it, not Claude.
    let validated
    try {
      validated = QuizSpecSchema.parse(spec)
    } catch (err: any) {
      const issues = err?.issues ?? []
      const summary = issues
        .map((i: any) =>
          Array.isArray(i.path) && i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message
        )
        .join("; ") || "invalid spec"
      return NextResponse.json(
        { error: "invalid_spec", message: summary },
        { status: 400 }
      )
    }

    const { data: quiz, error: fetchError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", quiz_id)
      .single()
    if (fetchError) throw fetchError

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

    return NextResponse.json({ quiz: updateRes.data })
  } catch (err: any) {
    console.error("update route error:", err)
    return NextResponse.json(
      { error: "server_error", message: err.message ?? "Unexpected error." },
      { status: 500 }
    )
  }
}
