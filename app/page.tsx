"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { MicroLabel } from "@/components/ui/typography"
import { ErrorLine } from "@/components/ui/error-line"
import { Nav } from "@/components/nav"
import { Spinner } from "@/components/ui/spinner"
import type { ClarificationQuestion } from "@/components/clarification-panel"

// Lazy-load the clarification UI — most prompts never trigger it, so it shouldn't
// ship in the initial home-page bundle.
const ClarificationPanel = dynamic(
  () => import("@/components/clarification-panel").then((m) => m.ClarificationPanel),
  {
    ssr: false,
    loading: () => (
      <Card padding={0} className="overflow-hidden">
        <div className="p-8 flex items-center justify-center text-[13px] text-[var(--muted-fg)]">
          <Spinner size={14} /> <span className="ml-2">Loading…</span>
        </div>
      </Card>
    ),
  }
)

const FEATURE_PILLS = [
  "Four question types",
  "Scored results",
  "Shareable link",
  "Live analytics",
  "No signup to try",
]
const FEATURE_PILLS_MOBILE = ["Four question types", "Scored results", "Shareable"]

const EXAMPLES: Record<string, string> = {
  "Nutrition check":
    "Figures out if someone's eating too much ultra-processed food. Ask about breakfast, label reading, home cooking, and fast food. Results: On Track, A Few Slips, Mostly Processed.",
  "Fitness style":
    "Pins down someone's fitness style — Strength, Endurance, Balance, or Mixed. Include a scale question about how hard they usually push themselves.",
  "Habit audit":
    "Tells someone whether they're a Routine Builder, Streak Chaser, or Freewheeler. Ask about morning habits, consistency, and what trips them up.",
  "Personality type":
    "Places someone as Analyst, Connector, Builder, or Explorer. Mix yes/no and scale questions. Keep the tone warm.",
  "Learning style":
    "Identifies whether someone learns best Visually, Aurally, through Reading, or Hands-on. End with a free-text about their best learning moment.",
  "Morning routine":
    "Tells someone if they're an Early Riser, Slow Starter, Mid-morning, or Night Owl. Ask about wake time, caffeine reliance, and phone habits.",
  "Sleep quality":
    "Diagnoses someone's sleep habits. Cover screen time before bed, consistency of wake time, and how rested they feel. Results: Solid Sleeper to Sleep Debt.",
  "Hydration audit":
    "Figures out if someone's drinking enough water. Ask about daily intake, caffeine balance, and how they feel in the afternoon.",
  "Snacking style":
    "Places someone as a Mindful Muncher, Emotional Eater, Grazer, or Strict Three-Meal type. Mix scale and multiple choice.",
  "Productivity style":
    "Diagnoses someone's work rhythm — Deep Focuser, Rapid Fire, Reactive, or Scattered. Include a scale on how often they check Slack.",
  "Stress response":
    "Identifies how someone handles stress — Freeze, Fight, Flight, or Flow. Ask about work pressure, sleep impact, and recovery habits.",
  "Digital detox":
    "Assesses whether someone's ready for a phone break. Ask about screen time, first-thing-in-morning phone habits, and how they feel after scrolling.",
  "Remote work fit":
    "Tells someone if they thrive Remote, Hybrid, or In-Office. Ask about focus, social needs, and home setup.",
  "Travel style":
    "Pins down whether someone's a Planner, Wanderer, Resort Relaxer, or Adventurer. Include questions about packing, itinerary, and ideal day.",
  "Creative archetype":
    "Places someone as a Maker, Remixer, Thinker, or Performer. Ask about their creative process and what blocks them.",
  "Spending archetype":
    "Tells someone if they're a Saver, Spender, Planner, or Avoider. Ask about tracking, impulse purchases, and how they feel checking their balance.",
  "Reading habits":
    "Identifies someone as a Deep Reader, Skimmer, Listener, or Collector. Include questions about pace, format preference, and finish rate.",
  "Friendship type":
    "Tells someone if they're an Initiator, Maintainer, Floater, or Deepener in friendships. Mix yes/no with scale questions.",
  "Date night style":
    "Pins someone as a Classic, Adventurer, Homebody, or Mix-it-up type. Ask about ideal dates, effort level, and conversation depth.",
  "Host or guest":
    "Diagnoses whether someone's a natural Host, Guest, Organizer, or Skipper. Ask about social events and how they feel after.",
  "Conflict style":
    "Places someone as Avoider, Debater, Diplomat, or Direct. Ask about workplace and personal conflicts separately.",
  "Decision style":
    "Tells someone if they decide with Gut, Data, Gut-Then-Data, or Committee. Ask about recent big and small decisions.",
  "Risk appetite":
    "Pins someone as Cautious, Calculated, Bold, or Reckless. Include financial, career, and lifestyle risk questions.",
  "Communication style":
    "Identifies someone as Direct, Diplomatic, Storyteller, or Listener. Ask how they deliver tough feedback.",
  "Maker vs manager":
    "Tells someone whether they work better as a Maker (heads-down), Manager (coordinating), or Hybrid. Cover meeting tolerance and focus blocks.",
  "Meeting tolerance":
    "Diagnoses how well someone handles meeting-heavy days. Ask about energy before and after meetings and preferred meeting length.",
  "Deep work persona":
    "Pins someone as a Monk, Sprinter, Juggler, or Reactive worker. Include a scale on how often they're interrupted.",
  "Career values":
    "Places someone as Impact-driven, Craft-driven, People-driven, or Security-driven. Ask about what makes a good work day.",
  "Goal-setting style":
    "Tells someone if they're a SMART Setter, Dreamer, Sprinter, or Drifter. Include a question about a recent goal and how it went.",
  "Consistency score":
    "Measures how consistent someone is with their habits. Ask about streaks, falling off, and recovery after missed days.",
  "Morning person":
    "Diagnoses if someone's truly a morning person or forcing it. Ask about natural wake time versus alarm-required wake time.",
  "Runner type":
    "Pins someone as a Marathoner, Sprinter, Casual, or Reluctant runner. Include pace, frequency, and why-you-run questions.",
  "Home workout":
    "Tells someone what home workout fits them — Yoga, HIIT, Strength, or Low-Impact. Ask about space, equipment, and energy.",
  "Recovery habits":
    "Diagnoses how well someone recovers between workouts. Ask about stretching, sleep, and rest days.",
  "Flexibility check":
    "Rates someone's mobility level. Include scale questions about stretching frequency and common tight areas.",
  "Active lifestyle":
    "Tells someone if they're a Daily Mover, Weekend Warrior, Scheduled Exerciser, or Sedentary. Ask about step count and desk hours.",
  "Plant parent":
    "Places someone as Thumb-of-Gold, Survivor, Killer, or New Parent. Include how many plants they have and success rate.",
  "Minimalism level":
    "Tells someone how minimalist they are — Monk, Intentional, Balanced, or Collector. Ask about wardrobe, possessions, and clutter.",
  "Hobby finder":
    "Suggests a hobby based on someone's energy — Creative, Physical, Social, or Solo. Ask about free-time preferences and skill-building appetite.",
  "Gut health":
    "Figures out how well someone's digestion is doing. Ask about fiber, fermented foods, regularity, and symptoms. Keep it friendly.",
  "Supplement stack":
    "Rates someone's current supplement routine — Overloaded, Balanced, Sparse, or None. Include what they take and why.",
  "Money personality":
    "Tells someone their money archetype — Steward, Avoider, Monk, or Mogul. Ask about savings rate, budget tracking, and money stress.",
  "Budgeting style":
    "Identifies someone as a Tracker, Envelope user, Ignore-and-hope, or App-driven budgeter. Include method and consistency questions.",
  "Investor type":
    "Places someone as Aggressive, Moderate, Conservative, or Avoider. Ask about risk tolerance and financial goals.",
  "Student archetype":
    "Places someone as a Front-Row, Note-Taker, Night-Before, or Cruiser student type. Include pacing and memorization strategy questions.",
  "Note-taking":
    "Identifies the best note-taking method — Cornell, Mind Map, Outline, or Scribble. Ask about retention and review habits.",
  "Introvert spectrum":
    "Places someone on the introversion spectrum with nuance — Introvert, Ambivert Leaning In, Ambivert Leaning Out, or Extrovert.",
  "Commute type":
    "Tells someone if their commute is Restorative, Productive, Draining, or Nonexistent. Ask how they spend it.",
  "Weekend recharge":
    "Diagnoses how someone recharges — Social, Solo, Active, or Flat. Ask about Sunday-night energy levels.",
  "Night owl check":
    "Figures out if someone's a true night owl or just has bad sleep habits. Include peak energy time and wake difficulty.",
  "Feedback style":
    "Tells someone how they give feedback — Sandwich, Direct, Delayed, or Silent. Ask about a recent tough conversation.",
  "Tidiness level":
    "Places someone as a Neat Freak, Controlled Chaos, Selective, or Comfortable Mess type. Ask about visible spaces versus drawers.",
}

const EXAMPLE_KEYS = Object.keys(EXAMPLES)

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function rememberCreatedQuiz(id: string) {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem("createdQuizzes")
    const list: string[] = raw ? JSON.parse(raw) : []
    if (!list.includes(id)) list.push(id)
    window.localStorage.setItem("createdQuizzes", JSON.stringify(list))
  } catch {
    // localStorage disabled — fail silently, creator just won't see the edit loop
  }
}

type Stage = "idle" | "clarifying"

export default function Home() {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState("")
  const [stage, setStage] = useState<Stage>("idle")
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([])
  const [clarificationLanguage, setClarificationLanguage] = useState<string | undefined>(undefined)
  // Start with a deterministic slice so server/client initial render match,
  // then reshuffle on mount for a fresh set each visit.
  const [examplePool, setExamplePool] = useState<string[]>(() => EXAMPLE_KEYS.slice(0, 5))
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setExamplePool(shuffle(EXAMPLE_KEYS).slice(0, 5))
  }, [])

  useEffect(
    () => () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    },
    []
  )

  const typeInto = useCallback((text: string) => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current)
      typingTimerRef.current = null
    }
    setPrompt("")
    setTyping(true)
    let i = 0
    typingTimerRef.current = window.setInterval(() => {
      i += 1
      setPrompt(text.slice(0, i))
      if (i >= text.length) {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current)
        typingTimerRef.current = null
        setTyping(false)
        textareaRef.current?.focus()
      }
    }, 18)
  }, [])

  async function callGenerate(promptToSend: string, clarified: boolean) {
    const res = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptToSend, clarified }),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, data }
  }

  async function handleGenerate() {
    if (!prompt.trim() || typing) return
    setLoading(true)
    setError("")
    try {
      const { ok, data } = await callGenerate(prompt.trim(), false)

      if (!ok) {
        setError(data.message || data.error || "Something went wrong.")
        setLoading(false)
        return
      }

      if (data.kind === "clarification") {
        setClarificationQuestions(data.questions || [])
        setClarificationLanguage(data.language)
        setStage("clarifying")
        setLoading(false)
        return
      }

      if (data.kind === "quiz") {
        rememberCreatedQuiz(data.quiz.id)
        // Land creators on the preview page where they can review + edit the
        // spec without having to take their own quiz first.
        router.push(`/dashboard/${data.quiz.id}/preview`)
        return
      }

      setError("Unexpected response from server.")
      setLoading(false)
    } catch (err: any) {
      setError(err.message || "Network error.")
      setLoading(false)
    }
  }

  async function handleClarifiedSubmit(enrichedPrompt: string) {
    setLoading(true)
    setError("")
    try {
      const { ok, data } = await callGenerate(enrichedPrompt, true)

      if (!ok) {
        setError(data.message || data.error || "Something went wrong.")
        setLoading(false)
        return
      }

      if (data.kind === "quiz") {
        rememberCreatedQuiz(data.quiz.id)
        // Land creators on the preview page where they can review + edit the
        // spec without having to take their own quiz first.
        router.push(`/dashboard/${data.quiz.id}/preview`)
        return
      }

      setError("Unexpected response from server.")
      setLoading(false)
    } catch (err: any) {
      setError(err.message || "Network error.")
      setLoading(false)
    }
  }

  function handleSkipClarification() {
    handleClarifiedSubmit(prompt.trim())
  }

  function handleBackToPrompt() {
    setStage("idle")
    setClarificationQuestions([])
    setClarificationLanguage(undefined)
    setError("")
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleGenerate()
    }
  }

  const isClarifying = stage === "clarifying"

  return (
    <main className="min-h-screen flex flex-col">
      <Nav active="home" mobile={false} className="hidden lg:flex" />
      <Nav active="home" mobile className="flex lg:hidden" />

      {/* DESKTOP */}
      <section className="hidden lg:block px-10 xl:px-18 pt-14 xl:pt-18 pb-15">
        <div className="mx-auto max-w-[1360px] grid grid-cols-2 gap-10 xl:gap-16 items-start">
        <div>
          <MicroLabel className="!text-[var(--olive-dark)]">Olive · v1.2</MicroLabel>
          <h1
            className="font-serif text-[64px] leading-[1.02] tracking-[-0.025em] mt-5 mb-0 font-normal text-[var(--foreground)]"
            style={{ textWrap: "balance" as any }}
          >
            Turn a sentence<br />
            into a <em className="italic">funnel</em>.
          </h1>
          <p
            className="text-[16px] leading-[1.55] text-[var(--muted-fg)] max-w-[420px] mt-[22px] mb-9"
            style={{ textWrap: "pretty" as any }}
          >
            Describe a quiz in plain English. We draft the questions, scoring, and a shareable result page — ready in seconds.
          </p>
          <div className="flex flex-wrap gap-2">
            {FEATURE_PILLS.map((t) => (
              <Pill key={t} variant="soft">
                {t}
              </Pill>
            ))}
          </div>

          <div className="mt-18 flex gap-14" style={{ marginTop: 72 }}>
            {[
              { v: "12,480", l: "Quizzes generated" },
              { v: "4.3s", l: "Avg. time to draft" },
              { v: "71%", l: "Median completion" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-mono text-[22px] text-[var(--foreground)] tracking-[-0.02em]">
                  {s.v}
                </div>
                <MicroLabel className="mt-1 block">{s.l}</MicroLabel>
              </div>
            ))}
          </div>
        </div>

        {isClarifying ? (
          <ClarificationPanel
            originalPrompt={prompt}
            questions={clarificationQuestions}
            language={clarificationLanguage}
            loading={loading}
            onSubmit={handleClarifiedSubmit}
            onSkip={handleSkipClarification}
            onBack={handleBackToPrompt}
          />
        ) : (
          <Card padding={0} className="overflow-hidden">
            <div className="flex justify-between items-center px-5 py-[14px] border-b border-[var(--border)]">
              <MicroLabel>Describe your quiz</MicroLabel>
              <MicroLabel className="!text-[var(--faint)]">⌘↵ to generate</MicroLabel>
            </div>
            <div className="p-5">
              <textarea
                ref={textareaRef}
                className="tq-ta"
                placeholder="A 6-question quiz about someone's morning routine that tells them whether they're an Early Riser, Slow Starter, or Night Owl. Friendly, a little cheeky. Include one scale question."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onKeyDown}
                style={{ minHeight: 180, border: "none", padding: 0, fontSize: 15, lineHeight: 1.6 }}
              />
              {error && (
                <div className="mt-3">
                  <ErrorLine>{error}</ErrorLine>
                </div>
              )}
              <div className="flex justify-end items-center mt-4 pt-4 border-t border-[var(--border)]">
                <Button onClick={handleGenerate} disabled={loading || typing || !prompt.trim()}>
                  {loading ? (
                    <>
                      <Spinner size={14} /> Generating…
                    </>
                  ) : (
                    "Generate quiz →"
                  )}
                </Button>
              </div>
            </div>
            <div className="px-5 pt-[14px] pb-5 bg-[var(--background)] border-t border-[var(--border)]">
              <MicroLabel className="block mb-[10px]">Try an example</MicroLabel>
              <div className="flex flex-wrap gap-[7px]">
                {examplePool.map((t) => (
                  <Pill key={t} as="button" onClick={() => typeInto(EXAMPLES[t])}>
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
          </Card>
        )}
        </div>
      </section>

      {/* MOBILE / TABLET */}
      <section className="lg:hidden px-[22px] md:px-10 pt-8 pb-10 max-w-[720px] mx-auto w-full">
        <MicroLabel className="!text-[var(--olive-dark)]">Olive · v1.2</MicroLabel>
        <h1 className="font-serif text-[40px] leading-[1.02] tracking-[-0.025em] mt-[14px] mb-0 font-normal">
          Turn a sentence into a <em className="italic">funnel</em>.
        </h1>
        <p className="text-[15px] leading-[1.5] text-[var(--muted-fg)] mt-[14px] mb-[22px]">
          Describe a quiz in plain English. We draft it for you.
        </p>
        <div className="flex flex-wrap gap-[6px] mb-7">
          {FEATURE_PILLS_MOBILE.map((t) => (
            <Pill key={t} variant="soft" className="!text-[11.5px] !py-1 !px-[9px]">
              {t}
            </Pill>
          ))}
        </div>

        {isClarifying ? (
          <ClarificationPanel
            originalPrompt={prompt}
            questions={clarificationQuestions}
            language={clarificationLanguage}
            loading={loading}
            onSubmit={handleClarifiedSubmit}
            onSkip={handleSkipClarification}
            onBack={handleBackToPrompt}
          />
        ) : (
          <Card padding={0} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <MicroLabel>Describe your quiz</MicroLabel>
            </div>
            <div className="p-4">
              <textarea
                className="tq-ta"
                placeholder="A 6-question quiz about someone's morning routine that tells them their chronotype."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onKeyDown}
                style={{ minHeight: 120, border: "none", padding: 0, fontSize: 14 }}
              />
              {error && (
                <div className="mt-3">
                  <ErrorLine>{error}</ErrorLine>
                </div>
              )}
              <Button full className="mt-[14px]" onClick={handleGenerate} disabled={loading || typing || !prompt.trim()}>
                {loading ? (
                  <>
                    <Spinner size={14} /> Generating…
                  </>
                ) : (
                  "Generate quiz →"
                )}
              </Button>
            </div>
            <div className="px-4 pt-[14px] pb-4 bg-[var(--background)] border-t border-[var(--border)]">
              <MicroLabel className="block mb-2">Examples</MicroLabel>
              <div className="flex flex-wrap gap-[6px]">
                {examplePool.slice(0, 3).map((t) => (
                  <Pill key={t} as="button" onClick={() => typeInto(EXAMPLES[t])} className="!text-[12px]">
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
          </Card>
        )}
      </section>
    </main>
  )
}
