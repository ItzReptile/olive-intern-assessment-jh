import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { MicroLabel } from "@/components/ui/typography"
import { Nav } from "@/components/nav"
import { DashboardBody } from "./dashboard-body"
import { RangeFilter } from "@/components/range-filter"
import { parseRangeFromSearch, prevWindow } from "@/lib/range"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type QuizRow = {
  id: string
  title: string
  created_at: string
  responses: { id: string; completed_at: string | null; started_at: string | null }[]
}

const RANGE_SHORT: Record<string, string> = {
  "7d": "7d",
  "30d": "30d",
  all: "all time",
  custom: "custom",
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const win = parseRangeFromSearch(sp)
  const prev = prevWindow(win)
  const rangeKey = sp.range ?? "30d"
  const rangeShort = RANGE_SHORT[rangeKey] ?? rangeKey

  // Narrow select — dashboard grid doesn't need the full spec JSONB or prompt.
  // Cuts per-row payload by ~90% on quizzes with large generated specs.
  const { data } = await supabase
    .from("quizzes")
    .select("id, title, created_at, responses(id, completed_at, started_at)")
    .order("created_at", { ascending: false })

  const quizzes = (data ?? []) as QuizRow[]

  return (
    <main className="min-h-screen flex flex-col">
      <Nav active="dashboard" className="hidden md:flex" />
      <Nav active="dashboard" mobile className="flex md:hidden" />

      <section className="px-5 md:px-18 py-8 md:py-10 pb-16">
        <div className="mx-auto max-w-[1136px]">
          {/* Header */}
          <div className="flex justify-between items-end mb-7">
            <div>
              <MicroLabel>Workspace · personal</MicroLabel>
              <h1 className="font-serif text-[32px] md:text-[44px] font-normal tracking-[-0.025em] leading-none mt-2 mb-0">
                Your <em className="italic">quizzes</em>
              </h1>
            </div>
            <div className="hidden md:flex gap-2">
              <Link href="/">
                <Button>+ New quiz</Button>
              </Link>
            </div>
            <div className="flex md:hidden">
              <Link href="/">
                <Button size="sm">+ New</Button>
              </Link>
            </div>
          </div>

          {/* Range filter */}
          <div className="flex justify-end mb-3">
            <RangeFilter />
          </div>

          <DashboardBody
            quizzes={quizzes}
            win={win}
            prev={prev}
            rangeShort={rangeShort}
          />
        </div>
      </section>
    </main>
  )
}

