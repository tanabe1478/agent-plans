# Architecture Codemap

> Freshness: 2026-02-13

## Package Structure

```text
agent-plans/
├── apps/electron/
│   ├── src/main/        # Electron main process, IPC, services
│   ├── src/preload/     # contextBridge API exposure
│   ├── src/renderer/    # React UI
│   └── e2e/             # Electron Playwright tests
├── packages/shared/     # shared TypeScript types
└── hooks/               # Hook scripts
```

## Data Flow

```text
~/.agent-plans/plans/*.md (legacy: ~/.claude/plans/*.md)
   ↑            ↓
main/services (file I/O, parsing, status transitions)
   ↑            ↓
main/ipc handlers  <->  preload bridge  <->  renderer hooks/components
```

## Key Commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm lint
```
