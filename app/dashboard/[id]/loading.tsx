import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { MicroLabel } from "@/components/ui/typography"
import { Nav } from "@/components/nav"

export default function DrillDownLoading() {
  return (
    <main className="min-h-screen flex flex-col">
      <Nav active="dashboard" className="hidden md:flex" />
      <Nav active="dashboard" mobile className="flex md:hidden" />

      <section className="px-5 md:px-18 py-6 md:py-8 pb-16">
        <div className="mx-auto max-w-[1136px]">
          <Skeleton w={90} h={10} />
          <div className="mt-[18px]">
            <Skeleton w={280} h={40} r={6} />
            <div className="mt-[10px] flex gap-3">
              <Skeleton w={180} h={12} />
              <Skeleton w={60} h={20} r={999} />
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 md:grid-cols-4 border border-[var(--border)] rounded-[10px] bg-[var(--surface)] overflow-hidden">
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
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
            <div>
              <div className="flex justify-between mb-4">
                <Skeleton w={200} h={22} r={4} />
                <Skeleton w={120} h={12} />
              </div>
              <Card padding={24}>
                <div className="flex flex-col gap-[14px]">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i}>
                      <div className="flex justify-between mb-[6px]">
                        <Skeleton w={120} h={14} />
                        <Skeleton w={60} h={10} />
                      </div>
                      <Skeleton w={`${[80, 55, 35, 18][i]}%`} h={28} r={4} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div>
              <Skeleton w={140} h={22} r={4} className="mb-4" />
              <Card padding={22}>
                <div className="flex flex-col gap-[14px]">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton w={120} h={12} />
                      <Skeleton w={80} h={12} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <div className="mt-11">
            <MicroLabel>Recent responses</MicroLabel>
            <Card padding={0} className="mt-4 overflow-hidden">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`grid grid-cols-3 md:grid-cols-4 px-[18px] py-[14px] items-center gap-4 ${
                    i < 4 ? "border-b border-[var(--border)]" : ""
                  }`}
                >
                  <Skeleton w={90} h={10} />
                  <Skeleton w={60} h={14} />
                  <Skeleton w={120} h={14} />
                  <Skeleton w={40} h={10} className="hidden md:block ml-auto" />
                </div>
              ))}
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
