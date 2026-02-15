# session-pr-loop

Session-scoped PR loop helper for Codex.

This command does not start a separate Codex session. It only fetches PR/check/comment status so the current Codex conversation can decide and act.

## Commands

```bash
node tools/session-pr-loop/index.mjs snapshot --pr 43
node tools/session-pr-loop/index.mjs watch --pr 43 --interval 20 --timeout 1800
node tools/session-pr-loop/index.mjs submit --message "fix: address CI feedback"
node tools/session-pr-loop/index.mjs ack --pr 43 --comment-id 123456789
node tools/session-pr-loop/index.mjs ack --pr 43 --all
node tools/session-pr-loop/index.mjs create-pr --title "feat: xxx" --body "..." --base main
node tools/session-pr-loop/index.mjs reset --pr 43
node tools/session-pr-loop/index.mjs merge --pr 43
```

## Command Notes

- `submit`:
  - Runs `git add` + `git commit -m` + `git push` in one command.
  - Optional flags: `--files a,b,c`, `--remote origin`, `--branch <name>`, `--set-upstream`.
- `create-pr`:
  - Runs `gh pr create` and then returns created PR metadata.
  - Use `--title` + `--body`, or `--fill`.
  - Optional flags: `--base <branch>`, `--head <branch>`, `--draft`.

## nextAction values

- `wait_checks`: checks are still running
- `fix_failed_checks`: checks failed
- `fix_coderabbit_comments`: unresolved CodeRabbit comments exist
- `ready_to_merge`: merge conditions satisfied
- `blocked_draft`: PR is draft
- `blocked_changes_requested`: explicit changes requested
- `blocked`: not mergeable for another reason

## Local state

Acknowledged comments are stored in:

- `.codex/state/session-pr-loop/pr-<PR_NUMBER>.json`

A comment is considered unresolved again if its `updatedAt` changes.

## PermissionRequest Minimization

If your Codex environment has `node` allowed without extra approval, run commit/push/PR creation through this helper (`submit` / `create-pr`) rather than issuing raw `git` / `gh` commands from the agent.
