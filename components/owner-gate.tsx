"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MicroLabel } from "@/components/ui/typography"
import { Nav } from "@/components/nav"

/**
 * Client-side ownership guard. Ownership is tracked per-browser via
 * `localStorage.createdQuizzes` (set when the user generates a quiz). Not
 * real auth — there isn't any — but enough to keep strangers off each
 * other's dashboards in this prototype.
 *
 * Three states:
 *   - checking: SSR pass / initial client paint. Renders nothing so we don't
 *     flash owner-only content before the check completes.
 *   - owner: children.
 *   - stranger: a small "not your quiz" screen with a link home.
 */
export function OwnerGate({
  quizId,
  children,
}: {
  quizId: string
  children: React.ReactNode
}) {
  const [state, setState] = useState<"checking" | "owner" | "stranger">("checking")

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem("createdQuizzes")
      const list: string[] = raw ? JSON.parse(raw) : []
      setState(list.includes(quizId) ? "owner" : "stranger")
    } catch {
      setState("stranger")
    }
  }, [quizId])

  if (state === "checking") return null
  if (state === "owner") return <>{children}</>

  return (
    <main className="min-h-screen flex flex-col">
      <Nav className="hidden md:flex" />
      <Nav mobile className="flex md:hidden" />
      <section className="flex-1 flex items-center justify-center px-5 py-20">
        <Card padding={28} className="max-w-[440px] w-full text-center">
          <MicroLabel className="!text-[var(--olive-dark)]">Not your quiz</MicroLabel>
          <h2 className="font-serif text-[26px] md:text-[32px] font-normal tracking-[-0.02em] leading-[1.1] mt-2 mb-3">
            Dashboards are <em className="italic">creator-only</em>
          </h2>
          <p className="text-[14px] text-[var(--muted-fg)] leading-[1.5] m-0 mb-5">
            This quiz wasn&apos;t created from this browser, so you can&apos;t see its
            stats or edit it. You can still take it — or draft one of your own.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Link href={`/quiz/${quizId}`}>
              <Button size="sm">Take the quiz</Button>
            </Link>
            <Link href="/">
              <Button variant="secondary" size="sm">
                Draft your own
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </main>
  )
}
