# AGENTS.md — Coordination Contract

> **READ THIS FIRST** if you are an AI agent (Cowork-Claude, Google Antigravity,
> Codex, etc.) opening this repo. This file is the single source of truth
> for how multiple agents share the codebase without stepping on each other.
>
> Maintainer: @rikdingus · Last updated: 2026-05-06

---

## 1. Project Context

This is **Project Korstmos** — a 10-node PoE-powered HVPS controller for
scintillation-based muon detection (cosmic ray observatory). Hardware is
ESP32-POE-ISO-IND; the dashboard is React + Node.js.

Before doing anything substantive, read these in order:

1. `README.md` — high-level overview
2. `LLM_CONTEXT.md` — full firmware source + verified live-board API responses
3. `docs/handoff_manifest.md` — current state and critical path
4. `docs/parallel_dev_plan.md` — the work-tracks split (frontend / backend / audit)
5. `docs/multi_model_workflow.md` — when to switch models

If anything in this file conflicts with `parallel_dev_plan.md`, that file wins
for **scope** decisions; this file wins for **process** decisions.

---

## 2. Active Agents

| Agent          | Platform                  | Model                    | Default role from `multi_model_workflow.md` |
|----------------|---------------------------|--------------------------|---------------------------------------------|
| Cowork-Claude  | Anthropic Claude (Cowork) | Claude Opus / Sonnet 4.6 | **Craftsman** — backend, firmware, complex logic |
| Antigravity    | Google Antigravity IDE    | Gemini 3 Pro / Flash     | **Architect** + **Auditor** — scaffolding, security review |
| Human (Rik)    | —                         | —                        | Tiebreaker, hardware bring-up, signs off on releases |

## 🔬 Ongoing Research: High-Speed Capture
As of May 6, 2026, we are investigating the detection of **20ns muon pulses** using the ESP32-POE nodes.
- **Reference**: [Issue #6](https://github.com/rikdingus/poe-hvps-controller/issues/6)
- **Technical Lead**: Antigravity / Claude
- **Key Strategy**: Transition from software interrupts to the **ESP32 PCNT (Pulse Counter)** hardware peripheral.
- **Agent Action**: All future firmware proposals must prioritize hardware-level capture to meet the 20ns timing requirement.

---
**Status**: Ready for hardware-level firmware implementation.

A new agent joining the project should add itself to this table in its first PR.

---

## 3. Branch Namespaces

Each agent works on its own branch namespace and merges via PR — never push
straight to `main`.

```
main                    ← protected, only Rik merges
claude/<short-topic>    ← Cowork-Claude branches
antigravity/<topic>     ← Antigravity branches
human/<topic>           ← Rik's manual changes
```

Examples: `claude/ina226-watchdog`, `antigravity/dashboard-emergency-stop`.

**Before you create a branch:** run `git fetch --all` and `git branch -r | grep -E '(claude|antigravity)/'` to see what the other agent is working on. If the topic overlaps, comment on their PR instead of forking the work.

---

## 4. File Ownership (soft)

These are *defaults*. Either agent may touch any file, but if you're editing
outside your default lane you must say so in the PR description.

| Path                          | Default owner    | Notes |
|-------------------------------|------------------|-------|
| `firmware/`                   | Cowork-Claude    | C++ on ESP32 — keep I2C single-tasked |
| `dashboard/app/server.js`     | Cowork-Claude    | Backend proxy + safety watchdog |
| `dashboard/app/src/components/` | Antigravity    | React UI (Track A in `parallel_dev_plan.md`) |
| `dashboard/app/src/style.css` | Antigravity      | Tailwind + glassmorphic theme |
| `docs/`                       | Either           | But announce big rewrites in PR |
| `hardware/` (KiCad)           | Human only       | Don't auto-edit schematics |
| `dashboard/config/safety_limits.json` | Human only | Safety rails — humans only |
| `LLM_CONTEXT.md`              | Either, **append-only** | Never delete verified API responses |

Hard rule from `parallel_dev_plan.md`: backend agent does NOT touch
`src/components/`; frontend agent does NOT touch `server.js` or `services/`.

---

## 5. Before You Edit Anything

1. `git fetch --all && git status` — make sure you're not editing on top of stale code.
2. Check for an open PR from the other agent touching the same file.
3. If you're about to change a file owned by the other agent, open an issue first.
4. For safety-critical paths (`firmware/src/main.cpp`, `safety_guardian.js`,
   `safety_limits.json`) — open a draft PR before writing code so the other
   agent can review the intent.

---

## 6. Commit Message Conventions

Conventional Commits, with an agent prefix so history is auditable:

```
[claude] feat(firmware): add OTA update endpoint
[antigravity] fix(ui): debounce slider on slow networks
[claude] docs(api): document POST /set replacement
[human] hw: bump pull-up resistors to 4.7k on detector-03
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `hw`, `safety`.

The `[safety]` scope (e.g. `feat(safety): ...`) **requires** a human reviewer
before merge — agents must not self-approve.

---

## 7. Handoff Protocol (when switching between agents)

Before signing off a session, the outgoing agent updates:

1. `docs/handoff_manifest.md` — current physical/software state, what's broken, what's next.
2. `docs/system_integration_plan.md` — checklist of remaining work.
3. Pushes all branches to GitHub (so the next agent can `git fetch` and see them).
4. Comments on any open PRs with status: `BLOCKED on hardware`, `READY FOR REVIEW`, `WIP — paused at slew-rate refactor`, etc.

The incoming agent's first action is `git fetch --all && cat docs/handoff_manifest.md`.

---

## 8. What NOT to Do

- ❌ Never commit secrets (Tailscale keys, WireGuard configs, API tokens).
  `.gitignore` already excludes `*.env`, `secrets/`, `.tailscale/`.
- ❌ Never delete data in `LLM_CONTEXT.md` — it's the verified-live-board record.
- ❌ Never modify `dashboard/config/safety_limits.json` without human sign-off.
- ❌ Never merge your own PR if it touches `firmware/` or anything tagged `safety`.
- ❌ Never invent API endpoints — verify against `LLM_CONTEXT.md` § 3 first.
- ❌ Don't bypass the slew-rate ramping in firmware. It exists to protect PMTs.

---

## 9. Quick Reference Commands

```powershell
# See what the other agent is working on
git fetch --all
git branch -r | Select-String 'claude/|antigravity/'

# Start a new branch
git switch -c claude/your-topic         # or antigravity/your-topic

# Hand off cleanly
git add -A
git commit -m "[claude] feat(scope): summary"
git push -u origin HEAD
gh pr create --fill --draft               # draft PR signals "WIP, look but don't merge"
```

---

## 10. Toolchain Expectations

The repo assumes these tools are on PATH (see `setup-windows.ps1` to install):

- `git`, `gh`, `node`, `pnpm`, `docker`, `python`, `uv`, `pio`, `jq`, `rg`

For an identical sandboxed env, both agents can use `.devcontainer/` — see
`.devcontainer/devcontainer.json`.

---

*If you, as an agent, find this contract unclear, propose an edit in a PR
rather than working around it. The contract exists to be improved.*
