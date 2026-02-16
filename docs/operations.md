# Operations Runbook

This document contains operational workflows that are intentionally kept out of the top-level `README.md`.

## Unsigned macOS Builds

This project currently distributes unsigned macOS builds by default.
On first launch, Gatekeeper may block the app.

Use either method below:

1. Finder: right-click the app and choose `Open`.
2. System Settings: `Privacy & Security` -> allow blocked app -> `Open Anyway`.

Advanced fallback:

```bash
xattr -dr com.apple.quarantine /Applications/agent-plans.app
```

## Session PR Loop (Codex)

This repository includes a session-scoped PR loop helper.

- Entrypoint: `tools/session-pr-loop/index.mjs`
- Tool reference: `tools/session-pr-loop/README.md`

Use this workflow when you want the current Codex conversation to continuously:

1. watch PR checks
2. fetch CodeRabbit comments
3. apply fixes in the same session
4. commit/push
5. repeat until merge-ready

State is stored in `.codex/state/session-pr-loop/` (ignored by git).

Prefer helper commands instead of raw `git` / `gh` when possible:

- `pnpm codex:pr-loop:status -- --pr <PR>`
- `pnpm codex:pr-loop:watch -- --pr <PR>`
- `pnpm codex:pr-loop:submit -- --message "<msg>"`
- `pnpm codex:pr-loop:ack -- --pr <PR> --comment-id <ID>`
- `pnpm codex:pr-loop:create-pr -- --title "<title>" --body "<body>"`
- `pnpm codex:pr-loop:merge -- --pr <PR>`
