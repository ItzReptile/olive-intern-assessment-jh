"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ErrorLine } from "@/components/ui/error-line"
import { Nav } from "@/components/nav"

export default function DrillDownError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <Nav active="dashboard" className="hidden md:flex" />
      <Nav active="dashboard" mobile className="flex md:hidden" />
      <section className="flex-1 flex items-center justify-center px-5 py-20">
        <div className="max-w-[460px] w-full text-center">
          <h2 className="font-serif text-[32px] font-normal tracking-[-0.025em] leading-[1.1] mb-4">
            We couldn&apos;t load this quiz.
          </h2>
          <div className="text-left mb-6">
            <ErrorLine>{error.message || "Unknown error"}</ErrorLine>
          </div>
          <div className="flex gap-[10px] justify-center">
            <Button onClick={reset}>Try again</Button>
            <Link href="/dashboard">
              <Button variant="secondary">Back to dashboard</Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
