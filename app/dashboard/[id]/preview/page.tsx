import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MicroLabel } from "@/components/ui/typography"
import { Nav } from "@/components/nav"
import { OwnerGate } from "@/components/owner-gate"
import { ShareButton } from "@/components/share-button"
import { PreviewEditor, type QuizRow } from "./preview-editor"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function SpecPreview({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, description, spec, prompt, version, created_at")
    .eq("id", id)
    .single()

  if (error || !data) return notFound()
  const quiz = data as QuizRow

  return (
    <OwnerGate quizId={quiz.id}>
    <main className="min-h-screen flex flex-col">
      <Nav active="dashboard" className="hidden md:flex" />
      <Nav active="dashboard" mobile className="flex md:hidden" />

      <section className="px-5 md:px-18 py-6 md:py-8 pb-16">
        <div className="mx-auto max-w-[820px]">
          <Link
            href={`/dashboard/${quiz.id}`}
            className="inline-flex items-center gap-[6px] text-[12.5px] text-[var(--muted-fg)] no-underline hover:text-[var(--foreground)] transition-colors"
          >
            ← Back to stats
          </Link>

          <div className="mt-[18px] flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <MicroLabel>Preview · creator view</MicroLabel>
              <h1 className="font-serif text-[32px] md:text-[40px] font-normal tracking-[-0.025em] leading-[1.05] m-0 mt-2">
                {quiz.title}
              </h1>
              <p className="text-[14.5px] text-[var(--muted-fg)] leading-[1.55] mt-2 mb-0 max-w-[600px]">
                {quiz.description}
              </p>
              <div className="mt-3">
                <ShareButton id={quiz.id} />
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/quiz/${quiz.id}`}>
                <Button size="sm">Take as a user →</Button>
              </Link>
            </div>
          </div>

          {/* Original prompt */}
          <div className="mt-8">
            <MicroLabel className="block mb-[10px]">Original prompt</MicroLabel>
            <Card padding={18} className="bg-[var(--background)]">
              <p className="text-[13.5px] leading-[1.55] text-[var(--foreground)] m-0 whitespace-pre-wrap">
                {quiz.prompt}
              </p>
            </Card>
          </div>

          <PreviewEditor initial={quiz} />
        </div>
      </section>
    </main>
    </OwnerGate>
  )
}
