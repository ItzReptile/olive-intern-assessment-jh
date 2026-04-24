import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { MicroLabel } from "@/components/ui/typography"
import { Nav } from "@/components/nav"

export default function DashboardLoading() {
  return (
    <main className="min-h-screen flex flex-col">
      <Nav active="dashboard" className="hidden md:flex" />
      <Nav active="dashboard" mobile className="flex md:hidden" />

      <section className="px-5 md:px-18 py-8 md:py-10 pb-16">
        <div className="mx-auto max-w-[1136px]">
          <div className="flex justify-between items-end mb-7">
            <div>
              <MicroLabel>Workspace · personal</MicroLabel>
              <h1 className="font-serif text-[32px] md:text-[44px] font-normal tracking-[-0.025em] leading-none mt-2 mb-0">
                Your <em className="italic">quizzes</em>
              </h1>
            </div>
            <Button>+ New quiz</Button>
          </div>

          {/* Stats row skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-[var(--border)] rounded-[10px] bg-[var(--surface)] overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`p-[22px_24px] ${
                  i < 3 ? "md:border-r md:border-[var(--border)]" : ""
                } ${i % 2 === 0 ? "border-r border-[var(--border)] md:border-r" : ""} ${
                  i >= 2 ? "border-t border-[var(--border)] md:border-t-0" : ""
                }`}
              >
                <Skeleton w={90} h={9} />
                <Skeleton w={70} h={22} r={6} className="mt-[14px]" />
                <Skeleton w={110} h={10} className="mt-[10px]" />
              </div>
            ))}
          </div>

          {/* Grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px] mt-8">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} padding={22}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Skeleton w="60%" h={18} r={5} />
                    <Skeleton w="75%" h={10} className="mt-[10px]" />
                  </div>
                  <Skeleton w={52} h={22} r={999} />
                </div>
                <div className="flex gap-7 mt-[22px]">
                  <div>
                    <Skeleton w={60} h={8} />
                    <Skeleton w={44} h={16} r={4} className="mt-2" />
                  </div>
                  <div>
                    <Skeleton w={72} h={8} />
                    <Skeleton w={44} h={16} r={4} className="mt-2" />
                  </div>
                </div>
                <Skeleton w="100%" h={4} className="mt-[18px]" />
                <div className="mt-[18px] pt-[14px] border-t border-[var(--border)] flex justify-between">
                  <Skeleton w={90} h={10} />
                  <Skeleton w={70} h={10} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
