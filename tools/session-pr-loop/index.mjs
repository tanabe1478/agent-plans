#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const DEFAULT_INTERVAL_SEC = 20;
const DEFAULT_TIMEOUT_SEC = 1800;

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;

    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return {
    command: positional[0] ?? 'snapshot',
    flags,
  };
}

async function runShell(command, cwd) {
  return new Promise((resolvePromise) => {
    const child = spawn('/bin/zsh', ['-lc', command], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += String(data);
    });

    child.stderr.on('data', (data) => {
      stderr += String(data);
    });

    child.on('close', (code) => {
      resolvePromise({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function runJson(command, cwd) {
  const result = await runShell(command, cwd);
  if (result.code !== 0) {
    throw new Error(`Command failed: ${command}\n${result.stderr || result.stdout}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (_error) {
    throw new Error(`Invalid JSON from command: ${command}\n${result.stdout}`);
  }
}

async function runOrThrow(command, cwd) {
  const result = await runShell(command, cwd);
  if (result.code !== 0) {
    throw new Error(`Command failed: ${command}\n${result.stderr || result.stdout}`);
  }
  return result;
}

function parseRepoFromPrUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`Cannot parse owner/repo from PR URL: ${url}`);
  }

  return {
    owner: match[1],
    repo: match[2],
    number: Number(match[3]),
  };
}

function escapeSingleQuotes(value) {
  return String(value).replace(/'/g, "'\\''");
}

function quote(value) {
  return `'${escapeSingleQuotes(value)}'`;
}

async function getRepoRoot(cwd) {
  const result = await runShell('git rev-parse --show-toplevel', cwd);
  if (result.code !== 0) {
    throw new Error(`Not a git repository: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

async function resolvePr(repoRoot, prFlag) {
  if (prFlag) {
    if (/^\d+$/.test(String(prFlag))) {
      const number = Number(prFlag);
      const pr = await runJson(`gh pr view ${number} --json url`, repoRoot);
      const parsed = parseRepoFromPrUrl(pr.url);
      return { number: parsed.number, owner: parsed.owner, repo: parsed.repo };
    }

    if (typeof prFlag === 'string' && prFlag.includes('/pull/')) {
      const parsed = parseRepoFromPrUrl(prFlag);
      return { number: parsed.number, owner: parsed.owner, repo: parsed.repo };
    }

    const pr = await runJson(`gh pr view ${prFlag} --json number,url`, repoRoot);
    const parsed = parseRepoFromPrUrl(pr.url);
    return { number: pr.number, owner: parsed.owner, repo: parsed.repo };
  }

  const current = await runJson('gh pr view --json number,url', repoRoot);
  const parsed = parseRepoFromPrUrl(current.url);
  return { number: current.number, owner: parsed.owner, repo: parsed.repo };
}

function getStateFile(repoRoot, prNumber) {
  return resolve(repoRoot, '.codex/state/session-pr-loop', `pr-${prNumber}.json`);
}

async function loadState(repoRoot, prNumber) {
  const path = getStateFile(repoRoot, prNumber);
  if (!existsSync(path)) {
    return { path, value: { ackedComments: {} } };
  }

  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    return { path, value: { ackedComments: {} } };
  }

  return {
    path,
    value: {
      ackedComments:
        parsed.ackedComments && typeof parsed.ackedComments === 'object'
          ? parsed.ackedComments
          : {},
    },
  };
}

async function saveState(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), 'utf-8');
}

function normalizeChecks(statusCheckRollup) {
  const checks = Array.isArray(statusCheckRollup) ? statusCheckRollup : [];

  const pending = [];
  const failed = [];
  const passed = [];

  for (const check of checks) {
    if (!check || typeof check !== 'object') continue;

    if (check.__typename === 'CheckRun') {
      const entry = {
        type: 'CheckRun',
        name: check.name,
        status: check.status,
        conclusion: check.conclusion,
      };

      if (check.status !== 'COMPLETED') {
        pending.push(entry);
        continue;
      }

      if (
        check.conclusion === 'SUCCESS' ||
        check.conclusion === 'NEUTRAL' ||
        check.conclusion === 'SKIPPED'
      ) {
        passed.push(entry);
      } else {
        failed.push(entry);
      }
      continue;
    }

    if (check.__typename === 'StatusContext') {
      const entry = {
        type: 'StatusContext',
        name: check.context,
        state: check.state,
      };

      if (check.state === 'PENDING') {
        pending.push(entry);
      } else if (check.state === 'SUCCESS') {
        passed.push(entry);
      } else {
        failed.push(entry);
      }
    }
  }

  return { pending, failed, passed };
}

function shortBody(body) {
  if (typeof body !== 'string') return '';
  const compact = body.replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
}

function deriveNextAction(snapshot) {
  if (snapshot.checks.pending.length > 0) {
    return 'wait_checks';
  }

  if (snapshot.checks.failed.length > 0) {
    return 'fix_failed_checks';
  }

  if (snapshot.coderabbit.actionable.length > 0) {
    return 'fix_coderabbit_comments';
  }

  if (snapshot.pr.isDraft) {
    return 'blocked_draft';
  }

  if (snapshot.pr.reviewDecision === 'CHANGES_REQUESTED') {
    return 'blocked_changes_requested';
  }

  if (snapshot.pr.mergeable === 'MERGEABLE') {
    return 'ready_to_merge';
  }

  return 'blocked';
}

async function buildSnapshot(repoRoot, prRef) {
  const pr = await runJson(
    `gh pr view ${prRef.number} --repo ${prRef.owner}/${prRef.repo} --json number,title,url,headRefName,baseRefName,isDraft,mergeable,reviewDecision,statusCheckRollup`,
    repoRoot
  );

  const unresolvedQuery = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              comments(first: 20) {
                nodes {
                  databaseId
                  path
                  url
                  body
                  updatedAt
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const unresolvedData = await runJson(
    [
      'gh api graphql',
      `-f query='${escapeSingleQuotes(unresolvedQuery)}'`,
      `-F owner='${prRef.owner}'`,
      `-F repo='${prRef.repo}'`,
      `-F number=${prRef.number}`,
    ].join(' '),
    repoRoot
  );

  const state = await loadState(repoRoot, prRef.number);
  const checks = normalizeChecks(pr.statusCheckRollup);

  const threadNodes =
    unresolvedData?.data?.repository?.pullRequest?.reviewThreads?.nodes &&
    Array.isArray(unresolvedData.data.repository.pullRequest.reviewThreads.nodes)
      ? unresolvedData.data.repository.pullRequest.reviewThreads.nodes
      : [];

  const reviewCoderabbit = threadNodes
    .filter((thread) => !thread?.isResolved)
    .flatMap((thread) =>
      (Array.isArray(thread?.comments?.nodes) ? thread.comments.nodes : [])
        .filter((comment) => comment?.author?.login === 'coderabbitai[bot]')
        .map((comment) => ({
          id: comment.databaseId,
          source: 'review',
          path: comment.path ?? null,
          url: comment.url,
          updatedAt: comment.updatedAt,
          body: shortBody(comment.body),
        }))
    )
    .filter((comment) => Number.isFinite(comment.id));

  const allComments = reviewCoderabbit.sort((left, right) =>
    String(left.updatedAt).localeCompare(String(right.updatedAt))
  );

  const actionable = allComments.filter((comment) => {
    const ack = state.value.ackedComments[String(comment.id)];
    if (!ack) return true;
    return ack.updatedAt !== comment.updatedAt;
  });

  const snapshot = {
    generatedAt: new Date().toISOString(),
    pr: {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName,
      isDraft: Boolean(pr.isDraft),
      mergeable: pr.mergeable,
      reviewDecision: pr.reviewDecision,
      repo: `${prRef.owner}/${prRef.repo}`,
    },
    checks,
    coderabbit: {
      total: allComments.length,
      actionable,
      ackedCount: allComments.length - actionable.length,
    },
    stateFile: state.path,
  };

  return {
    snapshot: {
      ...snapshot,
      nextAction: deriveNextAction(snapshot),
    },
    state,
    allComments,
  };
}

async function handleSnapshot(repoRoot, prRef) {
  const { snapshot } = await buildSnapshot(repoRoot, prRef);
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

function parseIds(value) {
  return String(value)
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => Number(token))
    .filter((num) => Number.isFinite(num));
}

async function currentHeadSha(repoRoot) {
  const result = await runShell('git rev-parse HEAD', repoRoot);
  if (result.code !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

async function currentBranch(repoRoot) {
  const result = await runShell('git rev-parse --abbrev-ref HEAD', repoRoot);
  if (result.code !== 0) {
    throw new Error(`Failed to resolve current branch\n${result.stderr || result.stdout}`);
  }

  const branch = result.stdout.trim();
  if (!branch || branch === 'HEAD') {
    throw new Error('Detached HEAD is not supported for submit/create-pr');
  }
  return branch;
}

async function handleAck(repoRoot, prRef, flags) {
  const { snapshot, state, allComments } = await buildSnapshot(repoRoot, prRef);

  const targetIds = flags.all
    ? snapshot.coderabbit.actionable.map((comment) => comment.id)
    : parseIds(flags['comment-id']);

  if (!flags.all && targetIds.length === 0) {
    throw new Error('ack requires --comment-id <id[,id...]> or --all');
  }

  const sha = flags.sha || (await currentHeadSha(repoRoot));
  const lookup = new Map(allComments.map((comment) => [comment.id, comment]));

  let acked = 0;
  for (const id of targetIds) {
    const comment = lookup.get(id);
    if (!comment) continue;

    state.value.ackedComments[String(id)] = {
      updatedAt: comment.updatedAt,
      ackedAt: new Date().toISOString(),
      sha,
      source: comment.source,
    };
    acked += 1;
  }

  await saveState(state.path, state.value);

  process.stdout.write(
    `${JSON.stringify(
      {
        pr: prRef.number,
        requested: targetIds.length,
        acked,
        sha,
        stateFile: state.path,
      },
      null,
      2
    )}\n`
  );
}

async function handleReset(repoRoot, prRef) {
  const state = await loadState(repoRoot, prRef.number);
  state.value.ackedComments = {};
  await saveState(state.path, state.value);
  process.stdout.write(
    `${JSON.stringify({ pr: prRef.number, stateFile: state.path, reset: true }, null, 2)}\n`
  );
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function handleWatch(repoRoot, prRef, flags) {
  const intervalSec = Number(flags.interval || DEFAULT_INTERVAL_SEC);
  const timeoutSec = Number(flags.timeout || DEFAULT_TIMEOUT_SEC);
  const started = Date.now();

  while (true) {
    const { snapshot } = await buildSnapshot(repoRoot, prRef);

    if (snapshot.nextAction !== 'wait_checks') {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
      process.exit(snapshot.nextAction === 'ready_to_merge' ? 0 : 2);
    }

    const elapsedSec = Math.floor((Date.now() - started) / 1000);
    if (elapsedSec >= timeoutSec) {
      process.stdout.write(
        `${JSON.stringify(
          {
            ...snapshot,
            nextAction: 'timeout',
            timeoutSec,
            elapsedSec,
          },
          null,
          2
        )}\n`
      );
      process.exit(3);
    }

    process.stdout.write(
      `[watch] PR #${snapshot.pr.number} pending checks: ${snapshot.checks.pending.length} (elapsed ${elapsedSec}s)\n`
    );

    await sleep(Math.max(intervalSec, 5) * 1000);
  }
}

async function mergePullRequest(repoRoot, prRef) {
  const query = `query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { id } } }`;
  const queryCmd = [
    'gh api graphql',
    `-f query='${query.replace(/'/g, "'\\''")}'`,
    `-F owner='${prRef.owner}'`,
    `-F repo='${prRef.repo}'`,
    `-F number=${prRef.number}`,
  ].join(' ');

  const queryData = await runJson(queryCmd, repoRoot);
  const pullRequestId = queryData?.data?.repository?.pullRequest?.id;
  if (!pullRequestId) {
    throw new Error(`Failed to resolve pull request id for #${prRef.number}`);
  }

  const mutation = `mutation($pullRequestId:ID!) { mergePullRequest(input:{pullRequestId:$pullRequestId, mergeMethod:SQUASH}) { pullRequest { number merged mergedAt url } } }`;
  const mutationCmd = [
    'gh api graphql',
    `-f query='${mutation.replace(/'/g, "'\\''")}'`,
    `-F pullRequestId='${pullRequestId}'`,
  ].join(' ');

  const merged = await runJson(mutationCmd, repoRoot);
  process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
}

async function handleSubmit(repoRoot, flags) {
  const message = typeof flags.message === 'string' ? flags.message.trim() : '';
  if (!message) {
    throw new Error('submit requires --message "<commit message>"');
  }

  const files =
    typeof flags.files === 'string'
      ? flags.files
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : [];

  if (files.length > 0) {
    const quotedFiles = files.map((file) => quote(file)).join(' ');
    await runOrThrow(`git add -- ${quotedFiles}`, repoRoot);
  } else {
    await runOrThrow('git add -A', repoRoot);
  }

  const commitCommand = `git commit -m ${quote(message)}`;
  const commitResult = await runShell(commitCommand, repoRoot);
  if (commitResult.code !== 0) {
    const combined = `${commitResult.stdout}\n${commitResult.stderr}`.toLowerCase();
    if (combined.includes('nothing to commit') || combined.includes('no changes added to commit')) {
      process.stdout.write(
        `${JSON.stringify(
          {
            submitted: false,
            reason: 'nothing_to_commit',
          },
          null,
          2
        )}\n`
      );
      return;
    }
    throw new Error(
      `Command failed: ${commitCommand}\n${commitResult.stderr || commitResult.stdout}`
    );
  }

  const remote =
    typeof flags.remote === 'string' && flags.remote.trim() ? flags.remote.trim() : 'origin';
  const branch =
    typeof flags.branch === 'string' && flags.branch.trim()
      ? flags.branch.trim()
      : await currentBranch(repoRoot);

  const pushArgs = [];
  if (flags['set-upstream']) {
    pushArgs.push('--set-upstream');
  }

  const pushCommand = ['git push', ...pushArgs, quote(remote), quote(branch)].join(' ');
  await runOrThrow(pushCommand, repoRoot);
  const sha = await currentHeadSha(repoRoot);

  process.stdout.write(
    `${JSON.stringify(
      {
        submitted: true,
        message,
        remote,
        branch,
        sha,
      },
      null,
      2
    )}\n`
  );
}

async function handleCreatePr(repoRoot, flags) {
  const title = typeof flags.title === 'string' ? flags.title.trim() : '';
  const body = typeof flags.body === 'string' ? flags.body : '';

  const createParts = ['gh pr create'];

  if (flags.draft) {
    createParts.push('--draft');
  }

  if (typeof flags.base === 'string' && flags.base.trim()) {
    createParts.push(`--base ${quote(flags.base.trim())}`);
  }

  if (typeof flags.head === 'string' && flags.head.trim()) {
    createParts.push(`--head ${quote(flags.head.trim())}`);
  }

  if (title) {
    createParts.push(`--title ${quote(title)}`);
  }

  if (flags.fill) {
    createParts.push('--fill');
  } else {
    createParts.push(`--body ${quote(body)}`);
  }

  if (!flags.fill && !title) {
    throw new Error('create-pr requires --title "<title>" when --fill is not used');
  }

  await runOrThrow(createParts.join(' '), repoRoot);

  const pr = await runJson(
    'gh pr view --json number,url,title,headRefName,baseRefName,isDraft',
    repoRoot
  );
  process.stdout.write(`${JSON.stringify(pr, null, 2)}\n`);
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const repoRoot = await getRepoRoot(process.cwd());
  const needPrRef = new Set(['snapshot', 'status', 'watch', 'ack', 'reset', 'merge']);
  const prRef = needPrRef.has(command) ? await resolvePr(repoRoot, flags.pr) : null;

  if ((command === 'snapshot' || command === 'status') && prRef) {
    await handleSnapshot(repoRoot, prRef);
    return;
  }

  if (command === 'watch' && prRef) {
    await handleWatch(repoRoot, prRef, flags);
    return;
  }

  if (command === 'ack' && prRef) {
    await handleAck(repoRoot, prRef, flags);
    return;
  }

  if (command === 'reset' && prRef) {
    await handleReset(repoRoot, prRef);
    return;
  }

  if (command === 'merge' && prRef) {
    await mergePullRequest(repoRoot, prRef);
    return;
  }

  if (command === 'submit') {
    await handleSubmit(repoRoot, flags);
    return;
  }

  if (command === 'create-pr') {
    await handleCreatePr(repoRoot, flags);
    return;
  }

  throw new Error(
    `Unknown command '${command}'. Use: snapshot | watch | ack | reset | merge | submit | create-pr`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
