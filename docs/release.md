# Release Runbook

This repository uses tag-based releases for Electron distribution.

## Versioning

- Tag format: `vX.Y.Z`
- Current planned release line starts at `v0.2.1`

## One-time setup

- Ensure `main` contains `.github/workflows/release.yml`
- Ensure GitHub Actions is enabled for this repository
- Configure the following repository secrets:
  - `CSC_LINK` (Developer ID Application certificate `.p12`, URL/path/base64)
  - `CSC_KEY_PASSWORD` (certificate password)
  - `APPLE_ID` (Apple ID email)
  - `APPLE_APP_SPECIFIC_PASSWORD` (app-specific password)
  - `APPLE_TEAM_ID` (Apple Developer Team ID)

## Create a release

```bash
git fetch origin
git checkout main
git pull --rebase origin main
git tag v0.2.1
git push origin v0.2.1
```

## What happens next

`Release` workflow runs on `macos-14` and performs:

1. `pnpm install --frozen-lockfile`
2. `pnpm check`
3. `pnpm lint`
4. `pnpm test`
5. `pnpm --filter @agent-plans/electron dist:mac`
6. Sign and notarize the app bundle
7. Upload `apps/electron/release/*.dmg` to GitHub Release

## Local DMG build (optional)

```bash
pnpm install
pnpm --filter @agent-plans/electron dist:mac
```

Generated files:

- `apps/electron/release/agent-plans-<version>-mac-arm64.dmg`

## Notes for `v0.2.0`

`v0.2.0` artifacts were unsigned/unnotarized and may be blocked by Gatekeeper.
Use `v0.2.1` or later for distributable builds.
