import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { MicroLabel } from "@/components/ui/typography"
import { Nav } from "@/components/nav"

export const metadata = {
  title: "Docs — Text to Quiz",
  description: "What Text-to-Quiz does, how to use it, how it works.",
}

export default function DocsPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Nav active="docs" className="hidden md:flex" />
      <Nav active="docs" mobile className="flex md:hidden" />

      <section className="px-5 md:px-18 py-10 md:py-16 pb-20">
        <div className="mx-auto max-w-[720px]">
          <MicroLabel className="!text-[var(--olive-dark)]">Docs · v1</MicroLabel>
          <h1 className="font-serif text-[40px] md:text-[56px] font-normal tracking-[-0.025em] leading-[1.05] mt-3 mb-4">
            Turn a sentence into a <em className="italic">funnel</em>.
          </h1>
          <p className="text-[16px] md:text-[17px] text-[var(--muted-fg)] leading-[1.6] mb-10">
            Text-to-Quiz drafts a scored, shareable quiz from a plain-English
            description. You describe what you want, we draft the questions,
            scoring, and result tiers. You preview, tweak, and share a live
            link. People take it, you see their results.
          </p>

          <Section title="How to use it" eyebrow="Quick start">
            <Step
              n="1"
              title="Describe your quiz"
              body={
                <>
                  On the <Link href="/" className="text-[var(--olive-dark)] hover:underline">home page</Link>, write a
                  sentence or two about the quiz you want. Topic, who it&apos;s for,
                  what the results should say.
                </>
              }
            />
            <Step
              n="2"
              title="Review on the preview page"
              body={
                <>
                  You&apos;ll land on a preview with every question, option, score, and
                  result tier. From there you can{" "}
                  <em className="italic">AI edit</em> (tell us what to change in
                  plain English) or <em className="italic">manually edit</em> any
                  field directly.
                </>
              }
            />
            <Step
              n="3"
              title="Share the link"
              body={
                <>
                  Hit <strong>Copy link</strong> on the dashboard. The recipient
                  takes the quiz at a clean URL and gets a shareable result card.
                </>
              }
            />
            <Step
              n="4"
              title="Watch the stats"
              body={
                <>
                  Your <Link href="/dashboard" className="text-[var(--olive-dark)] hover:underline">dashboard</Link>{" "}
                  shows starts, completions, avg. score, result distribution,
                  per-question breakdown, and a version-tagged response log.
                </>
              }
            />
          </Section>

          <Section title="What you can build" eyebrow="Quiz types">
            <p className="text-[14.5px] text-[var(--muted-fg)] leading-[1.6] mt-0">
              The generator handles three broad archetypes:
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-3 mt-4">
              <BulletCard
                label="Diagnostic"
                body={`"Are you eating too much ultra-processed food?" — higher score means worse outcome. Tiers go from healthy → concerning.`}
              />
              <BulletCard
                label="Personality"
                body={`"Are you an Early Riser, Slow Starter, or Night Owl?" — score determines which archetype you land in. No good/bad axis.`}
              />
              <BulletCard
                label="Readiness"
                body={`"Are you ready to move abroad?" — scored assessment with action-oriented CTAs per tier.`}
              />
            </ul>
          </Section>

          <Section title="Question types" eyebrow="Vocabulary">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <TypeCard
                name="Multiple choice"
                desc="2–6 options, each with its own score (0–5). Best for habits or preference questions."
              />
              <TypeCard
                name="Yes / No"
                desc="Binary. Separate scores for yes and no. Best for clear-cut questions."
              />
              <TypeCard
                name="Scale 1–5"
                desc="Frequency or intensity. Labels for 1 and 5. Optional invert for when 'higher = better'."
              />
              <TypeCard
                name="Free text"
                desc="Open reflection. Doesn't contribute to scoring. Always the last question."
              />
            </div>
          </Section>

          <Section title="Editing a quiz" eyebrow="Two paths">
            <div className="flex flex-col gap-3">
              <Card padding={18}>
                <div className="flex items-center gap-2 mb-2">
                  <Pill variant="olive">AI edit</Pill>
                </div>
                <p className="text-[14px] text-[var(--muted-fg)] leading-[1.55] m-0">
                  Type feedback like &ldquo;make the worst tier more forgiving&rdquo; or
                  &ldquo;add a yes/no about weekends.&rdquo; Claude rewrites the spec,
                  server re-computes the result ranges, and a diff shows exactly
                  what changed.
                </p>
              </Card>
              <Card padding={18}>
                <div className="flex items-center gap-2 mb-2">
                  <Pill>Manual edit</Pill>
                </div>
                <p className="text-[14px] text-[var(--muted-fg)] leading-[1.55] m-0">
                  Click into any field: question text, option scores, weight,
                  tier title, description, CTA. Add or remove questions,
                  options, and tiers. No LLM involved — pure schema-validated
                  saves.
                </p>
              </Card>
            </div>
          </Section>

          <Section title="Versioning" eyebrow="History">
            <p className="text-[14.5px] text-[var(--muted-fg)] leading-[1.6] mt-0">
              Every edit (AI or manual) bumps the quiz version and snapshots
              the previous spec. Each response is tagged with the version it
              was taken under, so if you change a question mid-campaign your
              stats still attribute old answers to the old version they saw.
              The dashboard lets you filter responses by version.
            </p>
          </Section>

          <Section title="Ownership" eyebrow="Scope">
            <p className="text-[14.5px] text-[var(--muted-fg)] leading-[1.6] mt-0">
              There&apos;s no auth in this prototype — ownership is tracked
              per-browser via localStorage. Quizzes you create show up on your
              dashboard. Links you share let others take the quiz, but they
              can&apos;t see the stats or edit it.
            </p>
          </Section>

          <Section title="Under the hood" eyebrow="Stack">
            <div className="flex flex-wrap gap-2">
              <Pill variant="soft">Next.js 16 · App Router</Pill>
              <Pill variant="soft">React 19</Pill>
              <Pill variant="soft">Tailwind v4</Pill>
              <Pill variant="soft">Supabase · Postgres</Pill>
              <Pill variant="soft">Anthropic · Claude Haiku 4.5</Pill>
              <Pill variant="soft">Structured outputs</Pill>
              <Pill variant="soft">Zod</Pill>
            </div>
            <p className="text-[13.5px] text-[var(--muted-fg)] leading-[1.55] mt-4 mb-0">
              Structured outputs guarantee the LLM produces a valid schema.
              The server handles all range arithmetic deterministically, so
              the model only focuses on content quality. See{" "}
              <Link href="/" className="text-[var(--olive-dark)] hover:underline">the home page</Link> to
              start.
            </p>
          </Section>

          <div className="mt-12 flex gap-2">
            <Link href="/">
              <Button size="lg">Draft a quiz →</Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="secondary">
                Go to dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string
  eyebrow: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-12">
      <MicroLabel className="block mb-2">{eyebrow}</MicroLabel>
      <h2 className="font-serif text-[26px] md:text-[30px] font-normal tracking-[-0.02em] leading-[1.15] mt-0 mb-4">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Step({
  n,
  title,
  body,
}: {
  n: string
  title: string
  body: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-[var(--border)] last:border-b-0">
      <div className="flex-shrink-0 w-[28px] h-[28px] rounded-full bg-[var(--olive-tint)] text-[var(--olive-dark)] border border-[var(--olive-tint-border)] inline-flex items-center justify-center font-mono text-[12px]">
        {n}
      </div>
      <div className="min-w-0">
        <div className="font-serif text-[17px] text-[var(--foreground)] tracking-[-0.015em] leading-[1.3] mb-1">
          {title}
        </div>
        <div className="text-[14px] text-[var(--muted-fg)] leading-[1.55]">{body}</div>
      </div>
    </div>
  )
}

function BulletCard({ label, body }: { label: string; body: string }) {
  return (
    <li className="pl-0">
      <Card padding={16}>
        <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4">
          <div className="font-mono text-[11px] text-[var(--olive-dark)] uppercase tracking-[0.08em] md:min-w-[95px]">
            {label}
          </div>
          <div className="text-[14px] text-[var(--muted-fg)] leading-[1.55]">{body}</div>
        </div>
      </Card>
    </li>
  )
}

function TypeCard({ name, desc }: { name: string; desc: string }) {
  return (
    <Card padding={16}>
      <div className="font-serif text-[16.5px] text-[var(--foreground)] tracking-[-0.015em] mb-1">
        {name}
      </div>
      <div className="text-[13.5px] text-[var(--muted-fg)] leading-[1.55]">{desc}</div>
    </Card>
  )
}
