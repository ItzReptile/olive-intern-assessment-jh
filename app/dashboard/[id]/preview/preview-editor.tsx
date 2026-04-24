"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { MicroLabel, MonoURL } from "@/components/ui/typography"
import { ErrorLine } from "@/components/ui/error-line"
import { Spinner } from "@/components/ui/spinner"
import type { QuizSpec, Question, Result } from "@/lib/quiz-schema"

export type QuizRow = {
  id: string
  title: string
  description: string
  spec: QuizSpec
  prompt: string
  version?: number
  created_at: string
}

type Mode = "ai" | "manual"

type DiffItem =
  | { kind: "title"; from: string; to: string }
  | { kind: "description"; from: string; to: string }
  | { kind: "question-added"; question: Question; index: number }
  | { kind: "question-removed"; question: Question }
  | { kind: "question-edited"; id: string; changes: string[] }
  | { kind: "tier-added"; result: Result; index: number }
  | { kind: "tier-removed"; title: string }
  | { kind: "tier-edited"; index: number; changes: string[] }

/* ─────────── helpers ─────────── */

function computeMaxScore(spec: QuizSpec) {
  let total = 0
  for (const q of spec.questions) {
    if (q.type === "multiple-choice") total += Math.max(0, ...q.options.map((o) => o.score)) * q.weight
    else if (q.type === "yes-no") total += Math.max(q.yes_score, q.no_score) * q.weight
    else if (q.type === "scale") total += 5 * q.weight
  }
  return total
}

function computeDiff(oldSpec: QuizSpec, newSpec: QuizSpec): DiffItem[] {
  const items: DiffItem[] = []
  if (oldSpec.title !== newSpec.title) items.push({ kind: "title", from: oldSpec.title, to: newSpec.title })
  if (oldSpec.description !== newSpec.description)
    items.push({ kind: "description", from: oldSpec.description, to: newSpec.description })

  const oldById = new Map(oldSpec.questions.map((q) => [q.id, q]))
  const newById = new Map(newSpec.questions.map((q) => [q.id, q]))

  newSpec.questions.forEach((q, i) => {
    const prev = oldById.get(q.id)
    if (!prev) return items.push({ kind: "question-added", question: q, index: i })
    const changes: string[] = []
    if (prev.question !== q.question) changes.push("text rewritten")
    if (prev.weight !== q.weight) changes.push(`weight ${prev.weight} → ${q.weight}`)
    if (prev.type !== q.type) changes.push(`type ${prev.type} → ${q.type}`)
    if (prev.type === q.type) {
      if (q.type === "yes-no") {
        const p = prev as typeof q
        if (p.yes_score !== q.yes_score) changes.push(`yes_score ${p.yes_score} → ${q.yes_score}`)
        if (p.no_score !== q.no_score) changes.push(`no_score ${p.no_score} → ${q.no_score}`)
      } else if (q.type === "multiple-choice") {
        const p = prev as typeof q
        const oldScores = p.options.map((o) => o.score).join(",")
        const newScores = q.options.map((o) => o.score).join(",")
        if (oldScores !== newScores) changes.push("option scores changed")
        if (p.options.length !== q.options.length) changes.push(`options ${p.options.length} → ${q.options.length}`)
      } else if (q.type === "scale") {
        const p = prev as typeof q
        if (p.invert !== q.invert) changes.push(`invert ${p.invert} → ${q.invert}`)
      }
    }
    if (changes.length) items.push({ kind: "question-edited", id: q.id, changes })
  })
  for (const q of oldSpec.questions) if (!newById.has(q.id)) items.push({ kind: "question-removed", question: q })

  const maxLen = Math.max(oldSpec.results.length, newSpec.results.length)
  for (let i = 0; i < maxLen; i++) {
    const o = oldSpec.results[i]
    const n = newSpec.results[i]
    if (!o && n) items.push({ kind: "tier-added", result: n, index: i })
    else if (o && !n) items.push({ kind: "tier-removed", title: o.title })
    else if (o && n) {
      const changes: string[] = []
      if (o.title !== n.title) changes.push(`title "${o.title}" → "${n.title}"`)
      if (o.description !== n.description) changes.push("description rewritten")
      if (o.cta?.text !== n.cta?.text) changes.push(`CTA "${o.cta?.text}" → "${n.cta?.text}"`)
      if (changes.length) items.push({ kind: "tier-edited", index: i, changes })
    }
  }
  return items
}

function newBlankQuestion(id: string, type: Question["type"]): Question {
  if (type === "multiple-choice") {
    return {
      id,
      type,
      question: "New question",
      weight: 1,
      options: [
        { id: "a", text: "Option A", score: 0 },
        { id: "b", text: "Option B", score: 1 },
      ],
    }
  }
  if (type === "yes-no") {
    return { id, type, question: "New yes/no question", weight: 1, yes_score: 0, no_score: 2 }
  }
  if (type === "scale") {
    return {
      id,
      type,
      question: "New scale question",
      weight: 1,
      min_label: "Never",
      max_label: "Always",
      invert: false,
    }
  }
  return { id, type: "free-text", question: "Anything you want to add?", weight: 1 }
}

function renumberIds(questions: Question[]): Question[] {
  return questions.map((q, i) => ({ ...q, id: `q${i + 1}` }))
}

/* ─────────── main component ─────────── */

export function PreviewEditor({ initial }: { initial: QuizRow }) {
  const [saved, setSaved] = useState<QuizRow>(initial)
  const [working, setWorking] = useState<QuizSpec>(initial.spec)
  const [prevSpec, setPrevSpec] = useState<QuizSpec | null>(null)
  const [mode, setMode] = useState<Mode>("ai")
  const [feedback, setFeedback] = useState("")
  const [patching, setPatching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const version = saved.version ?? 1

  // While a write is in flight, the UI is fully locked — no tab switching,
  // no input, no button clicks. Prevents two conflicting edits from
  // racing to the DB (and the second one winning with stale context).
  const busy = patching || saving

  const dirty = useMemo(() => JSON.stringify(saved.spec) !== JSON.stringify(working), [saved.spec, working])

  const diff = useMemo(() => (prevSpec ? computeDiff(prevSpec, saved.spec) : []), [prevSpec, saved.spec])
  const changedQuestionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const d of diff) {
      if (d.kind === "question-added") ids.add(d.question.id)
      else if (d.kind === "question-edited") ids.add(d.id)
    }
    return ids
  }, [diff])
  const changedTierIndices = useMemo(() => {
    const s = new Set<number>()
    for (const d of diff) {
      if (d.kind === "tier-added" || d.kind === "tier-edited") s.add(d.index)
    }
    return s
  }, [diff])

  // Read-mode displays the saved spec; edit-mode lets the user mutate `working`.
  const displaySpec = mode === "manual" ? working : saved.spec
  const maxScore = computeMaxScore(displaySpec)

  /* ── AI patch ── */
  async function handlePatch() {
    if (!feedback.trim() || patching) return
    setPatching(true)
    setErr("")
    try {
      const res = await fetch("/api/quiz/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: saved.id, feedback }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || "patch failed")
      setPrevSpec(saved.spec)
      setSaved(data.quiz)
      setWorking(data.quiz.spec)
      setFeedback("")
    } catch (e: any) {
      setErr(e.message || "Regeneration failed")
    } finally {
      setPatching(false)
    }
  }

  /* ── Manual save ── */
  async function handleSaveManual() {
    if (saving || !dirty) return
    setSaving(true)
    setErr("")
    try {
      const res = await fetch("/api/quiz/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: saved.id, spec: working }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || "save failed")
      setPrevSpec(saved.spec)
      setSaved(data.quiz)
      setWorking(data.quiz.spec)
      setMode("ai")
    } catch (e: any) {
      setErr(e.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  function handleDiscardManual() {
    setWorking(saved.spec)
    setMode("ai")
    setErr("")
  }

  /* ── Working-copy mutators (manual mode) ── */
  function updateQuestion(id: string, updater: (q: Question) => Question) {
    setWorking((w) => ({
      ...w,
      questions: w.questions.map((q) => (q.id === id ? updater(q) : q)),
    }))
  }

  function removeQuestion(id: string) {
    setWorking((w) => ({ ...w, questions: renumberIds(w.questions.filter((q) => q.id !== id)) }))
  }

  function addQuestion(type: Question["type"]) {
    setWorking((w) => {
      // Insert new question before the free-text (which must stay last).
      const freeTextIdx = w.questions.findIndex((q) => q.type === "free-text")
      const nextId = `q${w.questions.length + 1}`
      const newQ = newBlankQuestion(nextId, type)
      let list = [...w.questions]
      if (type === "free-text") {
        // Prevent adding a second free-text
        if (freeTextIdx >= 0) return w
        list.push(newQ)
      } else if (freeTextIdx >= 0) {
        list.splice(freeTextIdx, 0, newQ)
      } else {
        list.push(newQ)
      }
      return { ...w, questions: renumberIds(list) }
    })
  }

  function updateTier(idx: number, updater: (r: Result) => Result) {
    setWorking((w) => ({ ...w, results: w.results.map((r, i) => (i === idx ? updater(r) : r)) }))
  }

  function removeTier(idx: number) {
    setWorking((w) => ({ ...w, results: w.results.filter((_, i) => i !== idx) }))
  }

  function addTier() {
    setWorking((w) => {
      // Leave range math alone — server re-validates against ranges. Give the
      // new tier a temporary range that covers [0, 0]; on save, if the user
      // didn't adjust it, validation will fail and we'll surface the error.
      // Better: inherit the previous last tier's range to at least look valid,
      // with the understanding they'll adjust. But honestly the ranges are
      // server-computed in future phases; for now we just give [0,0].
      const existing = w.results
      const prevEnd = existing.length ? existing[existing.length - 1].range[1] : 0
      return {
        ...w,
        results: [
          ...existing,
          {
            range: [prevEnd + 1, prevEnd + 1] as [number, number],
            title: "New tier",
            description: "Describe what this result means.",
            cta: { text: "Learn more", url: "/" },
          },
        ],
      }
    })
  }

  /* ── Render ── */
  return (
    <>
      {/* Mode tabs — locked during any in-flight write */}
      <div className="mt-8 flex items-center gap-1 border-b border-[var(--border)]">
        <TabButton
          active={mode === "ai"}
          disabled={busy || (mode === "manual" && dirty)}
          title={
            mode === "manual" && dirty
              ? "Save or discard manual changes first"
              : busy
              ? "Wait for the current update to finish"
              : undefined
          }
          onClick={() => (mode === "manual" ? handleDiscardManual() : setMode("ai"))}
        >
          AI edit
        </TabButton>
        <TabButton
          active={mode === "manual"}
          disabled={busy}
          title={busy ? "Wait for the current update to finish" : undefined}
          onClick={() => setMode("manual")}
        >
          Manual edit
        </TabButton>
        <div className="flex-1" />
        <MonoURL className="!text-[11px] pb-2 pr-1">Version {version}</MonoURL>
      </div>

      {/* AI edit pane */}
      {mode === "ai" && (
        <div className="mt-4">
          <Card padding={18}>
            <MicroLabel className="block mb-[8px]">Tell us what to change — we'll regenerate</MicroLabel>
            <textarea
              className="tq-ta"
              placeholder={`e.g. "Make the result copy warmer" · "Add a yes/no about weekends" · "Rename the worst tier to 'Between Books'"`}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault()
                  handlePatch()
                }
              }}
              style={{ minHeight: 72, fontSize: 14, lineHeight: 1.55, background: "var(--background)" }}
            />
            {err && mode === "ai" && (
              <div className="mt-3">
                <ErrorLine>{err}</ErrorLine>
              </div>
            )}
            <div className="flex justify-between items-center mt-[12px] pt-[12px] border-t border-[var(--border)]">
              <MicroLabel className="!text-[var(--faint)]">⌘↵ to regenerate</MicroLabel>
              <Button onClick={handlePatch} disabled={busy || !feedback.trim()} size="sm">
                {patching ? (
                  <>
                    <Spinner size={14} /> Regenerating…
                  </>
                ) : (
                  "Regenerate →"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Manual edit — save/discard bar */}
      {mode === "manual" && (
        <div className="mt-4">
          <Card padding={14}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MicroLabel className="flex-1 min-w-[140px]">
                {dirty ? "Unsaved changes — edit questions/tiers below" : "No changes yet"}
              </MicroLabel>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={handleDiscardManual} disabled={saving}>
                  Discard
                </Button>
                <Button size="sm" onClick={handleSaveManual} disabled={saving || !dirty}>
                  {saving ? (
                    <>
                      <Spinner size={14} /> Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </div>
            {err && mode === "manual" && (
              <div className="mt-3">
                <ErrorLine>{err}</ErrorLine>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* What changed — only after save/patch (never in manual mode while editing) */}
      {diff.length > 0 && mode === "ai" && (
        <div className="mt-8">
          <MicroLabel className="block mb-[10px]">What changed in v{version}</MicroLabel>
          <Card padding={18} className="bg-[var(--background)]">
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {diff.map((d, i) => (
                <li key={i} className="text-[13.5px] leading-[1.5] flex items-start gap-[10px]">
                  <DiffMark kind={d.kind} />
                  <span className="text-[var(--foreground)]">{renderDiffText(d)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Questions + Tiers are wrapped in a fieldset so a single `disabled`
          on <fieldset> natively disables every descendant input/button while
          an edit is in flight. No per-component prop plumbing needed. */}
      <fieldset disabled={busy} className="contents">
        {/* Questions */}
        <div className="mt-10">
          <div className="flex justify-between items-baseline mb-4">
            <div className="font-serif italic text-[22px]">Questions</div>
            <MonoURL className="!text-[11px]">
              {displaySpec.questions.length} total · max score {maxScore}
            </MonoURL>
          </div>
          <div className="flex flex-col gap-3">
            {displaySpec.questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={i}
                editable={mode === "manual"}
                highlight={mode === "ai" && changedQuestionIds.has(q.id)}
                isNew={mode === "ai" && diff.some((d) => d.kind === "question-added" && d.question.id === q.id)}
                onChange={(next) => updateQuestion(q.id, () => next)}
                onRemove={() => removeQuestion(q.id)}
              />
            ))}
          </div>
          {mode === "manual" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <MicroLabel className="!text-[var(--muted-fg)] self-center mr-1">Add question:</MicroLabel>
              <Button size="sm" variant="secondary" onClick={() => addQuestion("multiple-choice")}>
                + Multiple choice
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addQuestion("yes-no")}>
                + Yes/No
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addQuestion("scale")}>
                + Scale
              </Button>
              {!displaySpec.questions.some((q) => q.type === "free-text") && (
                <Button size="sm" variant="secondary" onClick={() => addQuestion("free-text")}>
                  + Free text
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="mt-10">
          <div className="flex justify-between items-baseline mb-4">
            <div className="font-serif italic text-[22px]">Result tiers</div>
            <MonoURL className="!text-[11px]">{displaySpec.results.length} tiers</MonoURL>
          </div>
          <div className="flex flex-col gap-3">
            {displaySpec.results.map((r, i) => (
              <TierCard
                key={i}
                r={r}
                index={i}
                editable={mode === "manual"}
                highlight={mode === "ai" && changedTierIndices.has(i)}
                onChange={(next) => updateTier(i, () => next)}
                onRemove={() => removeTier(i)}
              />
            ))}
          </div>
          {mode === "manual" && (
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={addTier}>
                + Add tier
              </Button>
            </div>
          )}
        </div>
      </fieldset>
    </>
  )
}

/* ─────────── sub-components ─────────── */

// Destructive action button. Red accent, proper button styling, readable at
// mobile touch-target sizes. Used for "Remove question" / "Remove tier".
function RemoveButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#c1463a] px-[9px] py-[5px] rounded-[6px] border border-[#c1463a]/25 bg-[#c1463a]/5 hover:bg-[#c1463a]/10 hover:border-[#c1463a]/45 transition-colors whitespace-nowrap"
    >
      <span aria-hidden>×</span> Remove
    </button>
  )
}

// Compact × button for removing individual options inside a question. Round,
// red, touch-friendly.
function XRemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-[24px] h-[24px] flex-shrink-0 inline-flex items-center justify-center rounded-full text-[14px] text-[#c1463a] hover:bg-[#c1463a]/10 border border-transparent hover:border-[#c1463a]/25 transition-colors"
    >
      ×
    </button>
  )
}

function TabButton({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-2 text-[13px] border-b-2 transition-colors -mb-px ${
        active
          ? "text-[var(--foreground)] border-[var(--olive-dark)]"
          : "text-[var(--muted-fg)] border-transparent hover:text-[var(--foreground)]"
      } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[var(--muted-fg)]`}
    >
      {children}
    </button>
  )
}

function DiffMark({ kind }: { kind: DiffItem["kind"] }) {
  const isAdd = kind === "question-added" || kind === "tier-added"
  const isRemove = kind === "question-removed" || kind === "tier-removed"
  const sym = isAdd ? "+" : isRemove ? "−" : "~"
  const color = isAdd ? "var(--olive-dark)" : isRemove ? "#c1463a" : "var(--muted-fg)"
  return (
    <span
      className="font-mono text-[12px] w-[14px] inline-flex justify-center flex-shrink-0 mt-[2px]"
      style={{ color }}
    >
      {sym}
    </span>
  )
}

function renderDiffText(d: DiffItem): React.ReactNode {
  switch (d.kind) {
    case "title":
      return (
        <>
          title: <em className="italic">{d.from}</em> → <em className="italic">{d.to}</em>
        </>
      )
    case "description":
      return <>description rewritten</>
    case "question-added":
      return (
        <>
          added <span className="font-mono text-[12px]">Q{d.index + 1}</span> ({d.question.type}):{" "}
          <span className="italic">&ldquo;{d.question.question}&rdquo;</span>
        </>
      )
    case "question-removed":
      return (
        <>
          removed <span className="font-mono text-[12px]">{d.question.id}</span>:{" "}
          <span className="italic">&ldquo;{d.question.question}&rdquo;</span>
        </>
      )
    case "question-edited":
      return (
        <>
          edited <span className="font-mono text-[12px]">{d.id}</span> — {d.changes.join("; ")}
        </>
      )
    case "tier-added":
      return (
        <>
          new tier <em className="italic">&ldquo;{d.result.title}&rdquo;</em>
        </>
      )
    case "tier-removed":
      return (
        <>
          removed tier <em className="italic">&ldquo;{d.title}&rdquo;</em>
        </>
      )
    case "tier-edited":
      return (
        <>
          tier {d.index + 1} — {d.changes.join("; ")}
        </>
      )
  }
}

/* ── Question card ── */

function QuestionCard({
  q,
  index,
  editable,
  highlight,
  isNew,
  onChange,
  onRemove,
}: {
  q: Question
  index: number
  editable: boolean
  highlight: boolean
  isNew: boolean
  onChange: (q: Question) => void
  onRemove: () => void
}) {
  const typeLabel: Record<Question["type"], string> = {
    "multiple-choice": "Multiple choice · pick one",
    "yes-no": "Yes / No",
    scale: "Scale 1–5",
    "free-text": "Free response",
  }

  const cls = isNew
    ? "bg-[var(--olive-tint)] border-[var(--olive-tint-border)]"
    : highlight
    ? "bg-[var(--background)] border-[var(--border-strong)]"
    : ""

  return (
    <Card padding={20} className={cls}>
      {/* Meta row: Q# + type, plus remove. In read mode remove is absent so
          this just shows context; in edit mode the RemoveButton sits on the
          right where it won't fight the question text for space. */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <span className="font-mono text-[11px] text-[var(--faint)]">Q{index + 1}</span>
          <MicroLabel>{typeLabel[q.type]}</MicroLabel>
          {isNew && !editable && (
            <Pill variant="olive" className="!text-[10.5px] !px-[7px] !py-[2px]">
              new
            </Pill>
          )}
          {highlight && !isNew && !editable && (
            <Pill className="!text-[10.5px] !px-[7px] !py-[2px]">edited</Pill>
          )}
        </div>
        {editable && q.type !== "free-text" && (
          <RemoveButton onClick={onRemove} label="Remove question" />
        )}
      </div>

      {/* Question text — full width of the card, no side-gutter eating it. */}
      <div className="mb-3">
        {editable ? (
          <TextAreaInline
            value={q.question}
            onChange={(v) => onChange({ ...q, question: v })}
            placeholder="Question text"
          />
        ) : (
          <div className="text-[15px] text-[var(--foreground)] leading-[1.4]">
            {q.question}
          </div>
        )}
      </div>

      {/* Weight + scale invert, each with breathing room. Free-text's weight
          is fixed at 1 by the schema (it doesn't contribute to scoring) so
          we don't offer an editable control for it. */}
      <div className="mb-4 flex gap-3 items-center flex-wrap">
        {editable && q.type !== "free-text" ? (
          <NumberInline
            label="weight"
            value={q.weight}
            min={1}
            max={3}
            onChange={(v) => onChange({ ...q, weight: v })}
          />
        ) : (
          <MonoURL className="!text-[11px]">weight {q.weight}</MonoURL>
        )}
        {q.type === "scale" && (
          <label className="flex items-center gap-[6px] text-[11px] text-[var(--muted-fg)]">
            <input
              type="checkbox"
              disabled={!editable}
              checked={q.invert}
              onChange={(e) => editable && onChange({ ...q, invert: e.target.checked })}
            />
            inverted
          </label>
        )}
      </div>
      <div>
        {q.type === "multiple-choice" && (
          <MCOptions q={q} editable={editable} onChange={onChange} />
        )}
        {q.type === "yes-no" && <YesNoEditor q={q} editable={editable} onChange={onChange} />}
        {q.type === "scale" && <ScaleEditor q={q} editable={editable} onChange={onChange} />}
        {q.type === "free-text" && (
          <div className="italic text-[13px] text-[var(--muted-fg)] px-3 py-2 rounded-[7px] border border-dashed border-[var(--border-strong)] bg-[var(--background)]">
            Free-text response — does not contribute to score.
          </div>
        )}
      </div>
    </Card>
  )
}

function MCOptions({
  q,
  editable,
  onChange,
}: {
  q: Extract<Question, { type: "multiple-choice" }>
  editable: boolean
  onChange: (q: Question) => void
}) {
  function updateOption(i: number, patch: Partial<{ text: string; score: number }>) {
    onChange({ ...q, options: q.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) })
  }
  function removeOption(i: number) {
    if (q.options.length <= 2) return
    onChange({ ...q, options: q.options.filter((_, idx) => idx !== i) })
  }
  function addOption() {
    if (q.options.length >= 6) return
    const used = new Set(q.options.map((o) => o.id))
    const nextId = "abcdefghij".split("").find((c) => !used.has(c)) ?? `opt${q.options.length + 1}`
    onChange({
      ...q,
      options: [...q.options, { id: nextId, text: "New option", score: 0 }],
    })
  }
  return (
    <div className="flex flex-col gap-[6px]">
      {q.options.map((opt, i) => (
        <div
          key={opt.id}
          className={
            editable
              ? "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-3 py-2 rounded-[7px] border border-[var(--border)] bg-[var(--background)]"
              : "flex items-center justify-between gap-3 px-3 py-2 rounded-[7px] border border-[var(--border)] bg-[var(--background)]"
          }
        >
          <div className="flex items-center gap-[10px] min-w-0 flex-1">
            <span className="font-mono text-[10.5px] text-[var(--faint)] w-[14px] flex-shrink-0">
              {String.fromCharCode(65 + i)}
            </span>
            {editable ? (
              <TextInline
                value={opt.text}
                onChange={(v) => updateOption(i, { text: v })}
                className="flex-1 min-w-0"
              />
            ) : (
              <span className="text-[13.5px] text-[var(--foreground)]">{opt.text}</span>
            )}
          </div>
          <div className={editable ? "flex items-center gap-2 flex-shrink-0 pl-6 sm:pl-0" : "flex items-center gap-2 flex-shrink-0"}>
            {editable ? (
              <NumberInline label="score" value={opt.score} min={0} max={5} onChange={(v) => updateOption(i, { score: v })} />
            ) : (
              <span className="font-mono text-[11px] text-[var(--muted-fg)] whitespace-nowrap">score {opt.score}</span>
            )}
            {editable && q.options.length > 2 && (
              <XRemoveButton onClick={() => removeOption(i)} label={`Remove option ${String.fromCharCode(65 + i)}`} />
            )}
          </div>
        </div>
      ))}
      {editable && q.options.length < 6 && (
        <button
          type="button"
          onClick={addOption}
          className="text-[12px] text-[var(--olive-dark)] hover:underline self-start mt-1"
        >
          + add option
        </button>
      )}
    </div>
  )
}

function YesNoEditor({
  q,
  editable,
  onChange,
}: {
  q: Extract<Question, { type: "yes-no" }>
  editable: boolean
  onChange: (q: Question) => void
}) {
  return (
    <div className="flex gap-2">
      <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-[7px] border border-[var(--border)] bg-[var(--background)]">
        <span className="font-serif text-[18px] text-[var(--foreground)]">Yes</span>
        {editable ? (
          <NumberInline label="score" value={q.yes_score} min={0} max={5} onChange={(v) => onChange({ ...q, yes_score: v })} />
        ) : (
          <span className="font-mono text-[11px] text-[var(--muted-fg)]">score {q.yes_score}</span>
        )}
      </div>
      <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-[7px] border border-[var(--border)] bg-[var(--background)]">
        <span className="font-serif text-[18px] text-[var(--foreground)]">No</span>
        {editable ? (
          <NumberInline label="score" value={q.no_score} min={0} max={5} onChange={(v) => onChange({ ...q, no_score: v })} />
        ) : (
          <span className="font-mono text-[11px] text-[var(--muted-fg)]">score {q.no_score}</span>
        )}
      </div>
    </div>
  )
}

function ScaleEditor({
  q,
  editable,
  onChange,
}: {
  q: Extract<Question, { type: "scale" }>
  editable: boolean
  onChange: (q: Question) => void
}) {
  // On narrow screens two labels + an arrow + two number markers are too much
  // for one row, especially in editable mode where each label is an input.
  // Stack vertically on mobile, keep the horizontal layout on >=sm.
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-3 py-2 rounded-[7px] border border-[var(--border)] bg-[var(--background)]">
      <div className="flex items-center gap-2 min-w-0 sm:flex-1">
        <span className="font-mono text-[11px] text-[var(--muted-fg)] flex-shrink-0">1 ·</span>
        {editable ? (
          <TextInline value={q.min_label} onChange={(v) => onChange({ ...q, min_label: v })} className="flex-1" />
        ) : (
          <span className="font-mono text-[12px] text-[var(--muted-fg)]">{q.min_label}</span>
        )}
      </div>
      <span className="text-[var(--faint)] hidden sm:inline">→</span>
      <div className="flex items-center gap-2 min-w-0 sm:flex-1 sm:justify-end">
        <span className="font-mono text-[11px] text-[var(--muted-fg)] flex-shrink-0 sm:hidden">5 ·</span>
        {editable ? (
          <TextInline value={q.max_label} onChange={(v) => onChange({ ...q, max_label: v })} className="flex-1" />
        ) : (
          <span className="font-mono text-[12px] text-[var(--muted-fg)]">{q.max_label}</span>
        )}
        <span className="font-mono text-[11px] text-[var(--muted-fg)] flex-shrink-0 hidden sm:inline">· 5</span>
      </div>
    </div>
  )
}

/* ── Tier card ── */

function TierCard({
  r,
  index,
  editable,
  highlight,
  onChange,
  onRemove,
}: {
  r: Result
  index: number
  editable: boolean
  highlight: boolean
  onChange: (r: Result) => void
  onRemove: () => void
}) {
  // In read mode keep the compact single-row header (title + score range).
  // In edit mode on mobile, stack: title on its own line, then a meta row
  // with range inputs + the remove button. Prevents the title input from
  // being squeezed to ~100px by the two number inputs.
  return (
    <Card
      padding={18}
      className={highlight ? "bg-[var(--olive-tint)] border-[var(--olive-tint-border)]" : ""}
    >
      {editable ? (
        <div className="mb-3 flex flex-col gap-2">
          <TextInline
            value={r.title}
            onChange={(v) => onChange({ ...r, title: v })}
            className="font-serif text-[18px] tracking-[-0.015em] w-full"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <MicroLabel className="!text-[var(--muted-fg)]">Score range</MicroLabel>
              <NumberInline
                label=""
                value={r.range[0]}
                min={0}
                max={999}
                onChange={(v) => onChange({ ...r, range: [v, r.range[1]] })}
              />
              <span className="text-[var(--faint)] text-[11px]">–</span>
              <NumberInline
                label=""
                value={r.range[1]}
                min={0}
                max={999}
                onChange={(v) => onChange({ ...r, range: [r.range[0], v] })}
              />
            </div>
            <RemoveButton onClick={onRemove} label="Remove tier" />
          </div>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[18px] text-[var(--foreground)] tracking-[-0.015em]">
              {r.title}
            </div>
          </div>
          <MonoURL className="!text-[11.5px] whitespace-nowrap">
            Score {r.range[0]} – {r.range[1]}
          </MonoURL>
        </div>
      )}
      {editable ? (
        <TextAreaInline
          value={r.description}
          onChange={(v) => onChange({ ...r, description: v })}
          placeholder="2–3 sentences about this outcome"
        />
      ) : (
        <p className="text-[13.5px] text-[var(--muted-fg)] leading-[1.5] m-0">{r.description}</p>
      )}
      <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
        <MicroLabel>CTA</MicroLabel>
        {editable ? (
          <TextInline
            value={r.cta.text}
            onChange={(v) => onChange({ ...r, cta: { ...r.cta, text: v } })}
            className="flex-1 text-right"
          />
        ) : (
          <span className="text-[13px] text-[var(--olive-dark)]">{r.cta.text}</span>
        )}
      </div>
    </Card>
  )
}

/* ── Input primitives ── */

function TextInline({
  value,
  onChange,
  className = "",
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-[5px] px-2 py-[4px] text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--olive-dark)] ${className}`}
    />
  )
}

function TextAreaInline({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[5px] px-2 py-[6px] text-[14.5px] text-[var(--foreground)] outline-none focus:border-[var(--olive-dark)] resize-none"
      rows={2}
    />
  )
}

function NumberInline({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label className="inline-flex items-center gap-1 text-[11px] text-[var(--muted-fg)] font-mono">
      {label && <span>{label}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)))
        }}
        className="w-[42px] bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-[6px] py-[2px] text-center text-[11px] text-[var(--foreground)] outline-none focus:border-[var(--olive-dark)]"
      />
    </label>
  )
}
