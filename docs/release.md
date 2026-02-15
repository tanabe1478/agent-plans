# Release Runbook

This repository uses tag-based releases for Electron distribution.

## Distribution Modes

- `unsigned` (default): no Developer ID signing/notarization required
- `signed`: Developer ID signing + Apple notarization

Use `unsigned` for engineer-focused OSS distribution.

## Versioning

- Tag format: `vX.Y.Z`
- Example: `v0.2.2`

## One-time setup

- Ensure `main` contains `.github/workflows/release.yml`
- Ensure GitHub Actions is enabled for this repository

### Signed mode only (optional)

If you choose `signed`, configure these repository secrets:

- `CSC_LINK` (Developer ID Application certificate `.p12`, URL/path/base64)
- `CSC_KEY_PASSWORD` (certificate password)
- `APPLE_ID` (Apple ID email)
- `APPLE_APP_SPECIFIC_PASSWORD` (app-specific password)
- `APPLE_TEAM_ID` (Apple Developer Team ID)

## Create a release (tag-driven)

```bash
git fetch origin
git checkout main
git pull --rebase origin main
git tag v0.2.2
git push origin v0.2.2
```

For tag-triggered runs, release mode defaults to `unsigned`.

## Manual release (workflow_dispatch)

You can run the workflow manually and choose release mode:

- `mode=unsigned`
- `mode=signed`

## Workflow behavior

`Release` workflow runs on `macos-14` and performs:

1. `pnpm install --frozen-lockfile`
2. `pnpm check`
3. `pnpm lint`
4. `pnpm test`
5. Build DMG:
   - unsigned: `pnpm --filter @agent-plans/electron dist:mac:unsigned`
   - signed: `pnpm --filter @agent-plans/electron dist:mac`
6. Signed mode only: verify with `codesign`, `spctl`, `stapler validate`
7. Generate release notes with distribution mode + SHA256 checksums
8. Upload `apps/electron/release/*.dmg` to GitHub Release

## Local DMG build

Unsigned:

```bash
pnpm install
pnpm --filter @agent-plans/electron dist:mac:unsigned
```

Signed (requires Apple credentials):

```bash
pnpm install
pnpm --filter @agent-plans/electron dist:mac
```

Generated file:

- `apps/electron/release/agent-plans-<version>-mac-arm64.dmg`

## End-user first launch (unsigned)

Gatekeeper may block unsigned apps.

Users should do one of the following:

1. Finder: right-click app -> `Open`
2. System Settings -> `Privacy & Security` -> `Open Anyway`

Advanced fallback:

```bash
xattr -dr com.apple.quarantine /Applications/agent-plans.app
```

## Pre-publish smoke check (recommended)

Run automated smoke validation against the exact DMG you plan to distribute:

```bash
pnpm release:smoke -- --dmg apps/electron/release/agent-plans-<version>-mac-arm64.dmg
```

You can also validate a Release asset URL directly:

```bash
pnpm release:smoke -- --url "https://github.com/<owner>/<repo>/releases/download/vX.Y.Z/<artifact>.dmg"
```

The command outputs JSON with:

- Gatekeeper/quarantine signal
- First launch result
- Auto-allow retry result (default behavior)
- Recent launch logs

## Troubleshooting

- `CSC_*` / `APPLE_*` missing in signed mode:
  - The workflow fails during secret verification.
- DMG built but app blocked:
  - This is expected for unsigned mode. Follow first-launch steps.
- Notarization skipped:
  - Check `RELEASE_MODE` and Apple environment variables.

## Notes for historical versions

`v0.2.0` artifacts were unsigned/unnotarized and may be blocked by Gatekeeper.
