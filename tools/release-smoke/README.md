# release-smoke

Automated macOS smoke test for distributed DMG artifacts.

## What it does

1. Resolves a DMG source (`--dmg`, `--url`, or newest local release DMG)
2. Mounts the DMG
3. Copies `.app` to `~/Applications/agent-plans-smoke` by default
4. Checks Gatekeeper status (`spctl`) and quarantine attribute
5. Tries launch once
6. If blocked and `auto-allow` is enabled (default), clears quarantine and retries launch
7. Collects recent app logs and outputs a JSON summary

## Usage

```bash
pnpm release:smoke
pnpm release:smoke -- --dmg apps/electron/release/agent-plans-0.2.2-mac-arm64.dmg
pnpm release:smoke -- --url "https://github.com/<owner>/<repo>/releases/download/vX.Y.Z/<artifact>.dmg"
```

## Flags

- `--dmg <path>`: local DMG path
- `--url <url>`: remote DMG URL (downloaded with `curl`)
- `--install-dir <path>`: where app is copied for testing
- `--timeout-sec <n>`: launch wait timeout (default: `20`)
- `--no-auto-allow`: do not clear quarantine automatically
- `--keep-install`: keep copied app after test

## Exit code

- `0`: launch succeeded (first or second attempt)
- `1`: launch failed
