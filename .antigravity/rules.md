# Antigravity Workspace Rules — Project Korstmos

> Auto-loaded by Google Antigravity on workspace open. These rules apply
> to ALL agents spawned in this workspace (Architect, Implementer, Auditor).

## Read on entry

Before answering the user's first question, **read** in this order:

1. `AGENTS.md` — coordination contract with Cowork-Claude
2. `LLM_CONTEXT.md` — the firmware ground truth
3. `docs/handoff_manifest.md` — current state
4. `docs/parallel_dev_plan.md` — your default work track

## Identity

Identify yourself as `antigravity` in commits, PR descriptions, and any
status comments. Use the `antigravity/<topic>` branch namespace.

## Default model picks

- **Scaffolding / docs / refactors** → Gemini 3 Flash (cheaper, fast)
- **React UI components / complex JS** → Gemini 3 Pro
- **Security audits of `safety_guardian.js` or firmware** → Gemini 3 Pro
- **One-off natural-language transforms** → Gemini 3 Flash

## Stay in your lane (defaults)

Per `AGENTS.md` § 4 — Antigravity owns:

- `dashboard/app/src/components/`
- `dashboard/app/src/style.css`
- React hooks, Tailwind, glassmorphic UI work
- Architectural docs in `docs/`
- Audit work on Cowork-Claude's PRs (review-only, no edits)

Antigravity does NOT touch:

- `firmware/` (Cowork-Claude territory — PR-only with explicit approval)
- `dashboard/app/server.js` (Cowork-Claude — backend proxy)
- `dashboard/config/safety_limits.json` (humans only)
- `hardware/*.kicad_*` (humans only)

## Terminal command policy

Per Antigravity's "Terminal Command Auto Execution" setting:

- **Auto-allow**: `git status`, `git fetch`, `git diff`, `git log`, `gh pr list`,
  `npm run build`, `pnpm test`, `pio check`, `node --version`, `python -V`
- **Request review**: anything that writes to disk outside the workspace,
  installs packages, or touches Docker.
- **Always ask the user**: `git push`, `gh pr merge`, `pio run --target upload`
  (flashes hardware!), `docker compose up -d`, anything with `sudo`.

## Hardware safety hard rules

Even with explicit user permission, NEVER:

- Set a digital pot value above 200 (= ~78% of 255) without the user
  reconfirming in chat. The PMTs degrade above that.
- Disable the slew-rate ramping in `firmware/src/main.cpp`.
- Comment out or weaken anything in `safety_guardian.js`.
- Modify `dashboard/config/safety_limits.json` — that's human-only.

## Coordinating with Cowork-Claude

Cowork-Claude works in a separate process and pushes to `claude/*` branches.

Before starting work:

```bash
git fetch --all
git branch -r | grep claude/
```

If you see an open `claude/<topic>` branch overlapping your task, comment on
the PR (`gh pr comment`) instead of forking parallel work. Treat their
branches as authoritative within their lane.

When handing off back to the human or to Cowork-Claude:

1. Update `docs/handoff_manifest.md` with current state.
2. Push your branch.
3. Open a PR (draft if WIP) with the `[antigravity]` commit prefix.

## Output style

The maintainer wants to **learn as we go** — when you do something
non-obvious, briefly explain *why*, not just *what*. Keep explanations
inline with the work, not as separate essays.
