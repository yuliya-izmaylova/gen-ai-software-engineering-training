# 🤖 AI Usage Report: Banking Transactions API

> **AI tool:** Claude Code (CLI, Claude Opus 5.5) with the `feature-dev` plugin, its sub-agents, and a custom review agent
> **My role:** product owner and decision-maker. I set requirements, chose between options, asked for reviews and approved every change.
> **AI role:** "tech lead" and implementer. It analysed the task, asked clarifying questions, proposed designs, wrote the code, tests and docs, and ran verification.

---

## 1. Workflow at a glance

```
TASKS.md ──► Framework advice ──► feature-dev workflow
                                     │
               ┌─────────────────────┼──────────────────────┐
               ▼                     ▼                      ▼
       Clarifying questions   2 architect agents     Implementation + tests
       (I answered 4)         (minimal vs layered)   (70 → 85 tests)
                                     │                      │
                                     ▼                      ▼
                             I chose design "C"     3 review rounds by agents
                                                    → every finding reproduced
                                                    → fixed + regression test
                                                           │
                                                           ▼
                                           Screenshots, docs, commit, PR
```

---

## 2. Prompt log

My prompts are quoted exactly as I typed them; the results are summarised.

| # | My prompt | What the AI did | Outcome |
|---|-----------|-----------------|---------|
| 1 | `you are tech lead. check homework-1/TASKS.md. what framework is good option?` | Read the spec and compared Express, FastAPI and heavier frameworks. | Recommended **Express**, because it matches the task's samples (port 3000, `:id` routes, `package.json`). It warned early about float money, derived balances and multi-currency. |
| 2 | `/plugin install anthropics/feature-dev` → `claude plugin install feature-dev@claude-plugins-official` | My first install command used the wrong syntax and failed. The AI ran the corrected command. | The plugin was installed. |
| 3 | `/feature-dev:feature-dev` | It started a 7-phase guided workflow. It saw that the repo had no code yet, so it skipped code exploration and asked **4 clarifying questions**. | See §3. |
| 4 | My answers to the clarifying questions (§3) | It turned my overdraft rules into a concrete spec, then launched **2 architect agents in parallel**. | Two designs: minimal (5 files) and clean layered (about 20 files). |
| 5 | `C: Blend (Recommended)` | It implemented the blend: the minimal design's logic, laid out in the TASKS.md folder structure. | 70 tests passing, plus a live smoke test and a working demo seed. |
| 6 | `Fix everything (Recommended)` (after review round 1) | Fixed 2 confirmed bugs, the `run.sh` cleanup, and several DRY/doc issues. | 79 tests. |
| 7 | `Use the code-reviewer agent to review my staged changes.` | Ran my custom review agent. | It found an impossible-date bug and problems with what was staged. |
| 8 | `Use the code-reviewer agent to review my staged changes again.` | Second review by my Karpathy-guidelines reviewer. | Found a malformed-URL 500 and a test that could never fail. |
| 9 | `fix the date bug` | Added a calendar check and 4 tests. | 83 tests. |
| 10 | `go ahead, add necessary best self-expanative screenshots` | Fixed the round-2 findings. Captured **real command output** from the running API and rendered it to PNGs with headless Chrome. | 85 tests and 9 screenshots. |
| 11 | `commit and open the PR` | Committed. The push failed because this session had no GitHub credentials, so the AI explained the options. | I pushed myself. The AI then opened a pre-filled PR page in my browser, and I submitted it. |
| 12 | `the acceptanse criteria are … will we pass them?` | Self-assessed the work against the grading rubric. | It flagged that this AI-usage document was too thin, so it wrote this file. |

---

## 3. Decisions: mine vs. the AI's

The AI asked about anything the spec left open instead of guessing. Each question offered options with a recommendation, and I made the final call.

| Question | AI recommendation | My decision |
|----------|-------------------|-------------|
| Which Task 4 options? | n/a (asked me to choose) | **4D Rate limiting + 4A Account summary** |
| What happens when a withdrawal or transfer exceeds the balance? | Store it as `failed` and return 201 | **My own rule:** *"Do not create a completed financial transaction. Do not modify the account balance. Return HTTP 422 Unprocessable Entity. Record the rejected attempt for auditing and fraud monitoring. Return a machine-readable error code and details."* |
| How should multi-currency balances be reported? | Per-currency map | Accepted the recommendation |
| Language and tests? | JavaScript + Jest/Supertest | Accepted the recommendation |
| Which architecture? | Blend "C" | Accepted the recommendation |
| What to fix after each review? | Fix everything | Accepted, then asked for a second, independent review |

The 422 overdraft behaviour is the clearest case where **I overrode the AI's suggestion** with stricter, banking-style rules. The AI then documented why this goes beyond the spec's 200/201/400/404 list.

---

## 4. Where the AI was wrong, and how it was caught

The most useful part of the process was the AI checking its own work. **Every finding was reproduced before it was fixed**, and each fix got a regression test.

| # | Problem | Who caught it | How it was confirmed | Fix |
|---|---------|---------------|----------------------|-----|
| 1 | A test the AI wrote assumed `1.005` was a valid amount, but it has 3 decimals. | The test suite (first run) | The failing test showed the assumption was wrong. | The test was corrected; the code was right. |
| 2 | The 2-decimal check used a float tolerance, so `1e-12`, `10000000.004` and `1e21` were accepted. | Bug-review agent (round 1) | Ran `hasMaxTwoDecimals()` directly: all `true`. | Exact check plus a maximum amount. |
| 3 | A request body over 100kb returned **500** instead of 413. | Bug-review agent (round 1) | Supertest reproduction gave 500. | Body-parser 4xx errors are now passed through. |
| 4 | `run.sh --seed` could leave the server running after Ctrl+C. | Bug-review agent (round 1) | Process check after a stop signal. | Run node directly, trap EXIT, fail if the server doesn't start. |
| 5 | `?from=2024-02-31` was silently rolled over to **2024-03-02**. | My custom reviewer (round 2) | Called `validateFilters` and got a March date. | Calendar check, returning 400. |
| 6 | A malformed URL (`/transactions/%E0%A4%A`) returned **500**. | My Karpathy reviewer (round 3) | Supertest reproduction gave 500. | Any 4xx error is now passed through. |
| 7 | A test could never fail: its `expect` was only inside a `catch`. | My Karpathy reviewer (round 3) | Code inspection. | Switched to `expect(...).toThrow(...)`. |
| 8 | The README claimed `pending` "exists in the model", but it doesn't. | Simplicity-review agent | grep. | Wording corrected. |

**AI suggestions that were rejected:**
- A reviewer suggested removing the `now` parameter from `store.createTransaction` as "unused". The AI checked and found the date-filter tests rely on it to set fixed timestamps, so it was kept.
- The layered architecture (about 20 files, Zod, controllers, services, repository) was rejected as over-engineered for 5 endpoints.

**Tooling surprises the AI worked out:**
- Jest 30 produced **no verbose output** inside Claude Code. The AI traced this to the `AI_AGENT` environment variable, which makes Jest print a compact summary only. It reran the suite without that variable to get the real per-test output for the screenshot.
- The git push failed because the agent's shell had no GitHub credentials. The AI did not try to get around this; it explained the options and I pushed myself.

---

## 5. How AI output was verified

- **Automated tests:** grew from 70 to **85** Jest + Supertest tests, and every bug fix added a regression test.
- **Live checks:** the server was started and hit with curl and the demo seed script after each major change.
- **Independent reviews:** three review rounds with different reviewers. Two `feature-dev` reviewers focused on bugs and on simplicity; my custom reviewer, rewritten with Karpathy's guidelines, ran twice. The reviewers only read code and cannot edit it.
- **Reproduce before fixing:** no finding was accepted on the reviewer's word alone.
- **Screenshots from real output:** terminal screenshots 1–7 are rendered from actual command output captured from the running API. None were made up.

---

## 6. Comparing AI approaches

Only one AI product (Claude Code) was used. It still produced clearly different approaches, which can be compared:

| Approach | Strengths | Weaknesses |
|----------|-----------|------------|
| **Architect agent: "minimal"** | Fastest to read, hand-written validation that matches the required error format | Mixed storage with business logic in one file |
| **Architect agent: "clean layered"** | Testable layers, Zod schemas, error classes | About 20 files for 5 endpoints; controllers and services were mostly pass-through |
| **`feature-dev` code-reviewer agents** | Found numeric edge cases and missing error paths | Included one wrong suggestion (removing `now`) |
| **Custom Karpathy reviewer** | Strict about scope, staging problems and tests that can't fail; ran the tests and a staged snapshot itself | Stricter and slower; some items are style opinions |

**Takeaway:** running several agents with *different instructions* worked like getting several opinions. Each caught issues the others missed.

---

## 7. Prompting lessons

1. **Give a role and a concrete goal.** *"you are tech lead … what framework is good option?"* gave a reasoned recommendation with trade-offs, not just a list.
2. **Use a structured workflow** (`/feature-dev`). Forcing clarifying questions *before* coding surfaced the overdraft and multi-currency questions that the spec leaves open.
3. **Answer ambiguities with precise rules.** My five-sentence overdraft rule became exact, testable behaviour (422 + `INSUFFICIENT_FUNDS` + audit record).
4. **Ask for options, then choose.** Two contrasting architectures made the trade-off obvious.
5. **Review more than once, with different reviewers.** Each round found real bugs the earlier rounds missed.
6. **Make the AI prove it.** Asking for reproduction before fixes kept false positives out.

---

## 8. Screenshots

| Screenshot | Content |
|------------|---------|
| [`ai-prompt-1-planning.png`](screenshots/ai-prompt-1-planning.png) | Prompts → framework choice → clarifying questions → architecture *(recap rendered from the session transcript)* |
| [`ai-prompt-2-review-loop.png`](screenshots/ai-prompt-2-review-loop.png) | Reviews → reproduced bugs → fixes *(recap rendered from the session transcript)* |
| `claude-code-*.png` | Direct captures of the Claude Code terminal *(added by me)* |
| [`01`–`07`](screenshots/) | Real terminal output of the running API and the test suite |
