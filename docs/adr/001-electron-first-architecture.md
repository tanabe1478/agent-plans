# ADR-001: Electron-First Architecture

## Status
Accepted

## Decision
agent-plans is an Electron-native desktop application. There is no web deployment, no HTTP API server, and no separate web frontend package.

## Context
The project originally explored a web-based architecture with separate API server and frontend packages. However, the core use case — managing local Markdown plan files from `~/.agent-plans/plans` or `~/.claude/plans` — is inherently a local filesystem operation. A web architecture added unnecessary complexity (CORS, authentication, deployment) without providing meaningful benefit.

## Consideration
| Option | Pros | Cons |
|--------|------|------|
| **Web app + API server** | Browser access, multi-device | Requires hosting, auth, sync; file access needs server |
| **Electron-only (chosen)** | Direct filesystem access, native UX, no hosting | Desktop-only, platform builds required |
| **CLI-only** | Minimal surface area | No visual management, limited UX |

## Consequences
- All data access goes through Electron IPC (main process ↔ renderer)
- No HTTP endpoints to maintain or secure
- Distribution via DMG (macOS) and NSIS installer (Windows)
- CI must build platform-specific binaries
- The `apps/web/` directory is legacy and unused
- Docs and CI are Electron-oriented exclusively

## References
- `apps/electron/` — main application directory
- `CLAUDE.md` — "agent-plans is now an Electron-first native app"
- `docs/release.md` — distribution and CI workflow
