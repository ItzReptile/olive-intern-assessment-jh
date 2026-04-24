# DECISIONS.md

A short log of the product and technical decisions I made while building Text-to-Quiz.

---

## Quiz spec schema

Designed a typed spec with title, description, prompt, questions array, and results array.

Questions have id, type, weight, and options with per-option scores. Results use score ranges to map totals to outcomes. JSONB in Postgres because the structure is LLM-defined and varies per quiz — enforced at the app layer via Zod, not the DB layer.

Two Zod schemas actually: `LLMQuizSchema` for what Claude emits (no ranges, looser bounds) and `QuizSpecSchema` for what we store (ranges included, all bounds enforced). The server fills in the ranges between the two. More on why under "Prompt reliability".

Deliberately left out: image-based questions (no image hosting), branching logic (over-engineered for a funnel prototype), multiple result dimensions (single score axis covers all three example prompts in the brief).
## LLM choice

Tested both claude-sonnet-4-6 and claude-haiku-4-5 against identical prompts. 
Haiku produced equivalent quality output at 2x the speed and 3x lower cost. 

## Question type vocabulary

Four types: multiple-choice, yes-no, scale, free-text. Claude picks the type per question based on context — multiple-choice for habit questions, yes-no for binary, scale for frequency/rating, free-text for qualitative with no score contribution.

Skipped: image-based (requires an asset pipeline, over-engineered for a prototype), ranking/ordering (UI complexity not worth it at this scope).

## Scoring & results logic

Additive scoring with per-question weights. Final score = sum of (selected option score × question weight). Free-text scores 0. Results are score ranges — but the LLM does not write them. It outputs tiers in order (best → worst) and the server computes ranges by distributing [0, MAX_SCORE] evenly across them. Program-of-Thought: keep the model on content, do the arithmetic in code.

Deliberately left out: weighted dimensions (e.g. separate health vs lifestyle scores), branching paths, negative scoring. A single axis covers every example prompt in the brief.

Example — ultra-processed food quiz:

| Question | Weight | Pick | Option Score | Total |
|---|---|---|---|---|
| What does your breakfast look like? | 1 | Protein bar or shake | 3 | 3 |
| Do you read ingredient labels? | 2 | Never | 3 | 6 |
| How often do you cook at home? | 1 | Rarely | 2 | 2 |
| Describe your relationship with food | 1 | (free-text) | 0 | 0 |

**Total: 11 points**

Ranges:
- 0–4 → "You're doing great"
- 5–9 → "Room for improvement"
- 10–15 → "Danger zone"

11 lands in 10–15 → **Danger zone**

## Edit loop

<!-- After the first generation, how does a user iterate? Full regeneration, spec patching, or direct editing? Why? -->
Two paths, both on the preview page the creator lands on after generating.

AI edit: free-text feedback goes to `/api/quiz/patch`. Claude returns a new spec via structured outputs, server re-computes ranges, saves. A diff renders inline (`~ edited`, `+ added`, `− removed`) so the creator sees what changed without retaking the quiz.

Manual edit: every field is an inline input. Add/remove questions, options, tiers. `Save` hits `/api/quiz/update` — no LLM, just Zod validation.

Both bump `quizzes.version` and snapshot the outgoing spec into `quiz_versions` so old responses stay tied to the spec the respondent actually saw.

Picked this over full regeneration because creators almost always want small tweaks, not a redo.
## Prompt reliability

<!-- How do you validate LLM output? Retries? Fallbacks? What happens when it returns garbage? -->
Four layers, in order of how much they actually do:

1. Structured outputs via `output_config.format` with `zodOutputFormat(LLMQuizSchema)`. Constrained decoding at the model level — shape, types, required fields, enums are guaranteed. Kills the entire class of attempt-1 shape failures that prompt-only JSON
2. Program-of-Thought for arithmetic. Ranges are computed server-side from the question weights, not by the LLM. The thing Haiku was worst at is now impossible to get wrong.
3. Zod post-validation against `QuizSpecSchema`. Catches numeric bounds structured outputs can't enforce (score ∈ [0,5], weight ∈ [1,3], counts). On failure, one retry with the Zod error summary.
4. Transient-error retry. 429/5xx get exponential backoff; non-retryable errors throw.



## Data model

Two tables: quizzes and responses.

Quizzes store the original user prompt, the generated spec as JSONB, and metadata. The prompt is preserved specifically for the edit loop — Claude always has the original intent available.

Responses store answers as JSONB since question structure varies per quiz. The result_title field is denormalized to preserve what the user actually saw at time of submission, making it immune to future quiz edits. The started_at + completed_at split enables completion rate queries without guesswork.

JSONB over rigid columns because quiz structure is LLM-defined and varies per generation. Structure is enforced at the app layer via Zod, not the DB layer.

Added a third table for versioning: `quiz_versions`. Every edit (AI or manual) bumps `quizzes.version` and snapshots the outgoing spec here. `responses.version` is stamped at start time, so the dashboard can attribute old responses to the exact spec the respondent saw — and the question-breakdown view honestly hides responses from earlier versions since their questions may no longer exist.


## Cost

<!-- Approximate $ per generated quiz. Show your math. -->
Claude Haiku 4.5: $1/M input, $5/M output, $0.10/M cached input.

Per generation:
- First time (cold cache): ~$0.006
- Within 5 min (cached system prompt): ~$0.004
- One AI edit: ~$0.004
- One manual edit: $0

What $5 buys:
- ~850 first-time quiz generations, or
- ~1,150 generations in a warm session, or
- ~250 full creator sessions (1 generation + 3 AI edits), or
- unlimited manual edits on top of any of the above

Typical creator session ≈ $0.02.

## What I'd do differently with more time

<!-- Honest list. -->



LLM-generated option scores can have gaps or ties — the displayed max is reachable, but the minimum often isn't zero and two options sometimes score the same, so part of the scale is dead space and some answers are indistinguishable. Issues like this are invisible at generation time and only show up in aggregate data.

The hardest unsolved problem is prompt-to-schema quality at scale. 
Any individual quiz looks reasonable, but "reasonable" isn't the same as 
"optimal." The right question types, weights, score distributions, and result 
ranges for a given prompt are impossible to validate without real user data. 

With more time I'd build a feedback loop: track where users drop off per 
question, which results feel wrong (via a post-result rating), and use that 
signal to retrain the prompt or adjust weights automatically. Right now the 
system is a black box — it generates confidently but has no mechanism to 
learn whether the quiz it made was actually good.

These are more of a research problem as much as an engineering one.