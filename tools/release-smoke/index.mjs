#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';

const IS_MAC = process.platform === 'darwin';

function parseArgs(argv) {
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token || !token.startsWith('--')) continue;

    if (token === '--no-auto-allow') {
      flags['auto-allow'] = false;
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
    help: flags.help === true,
    dmg: typeof flags.dmg === 'string' ? flags.dmg : undefined,
    url: typeof flags.url === 'string' ? flags.url : undefined,
    installDir:
      typeof flags['install-dir'] === 'string'
        ? flags['install-dir']
        : join(process.env.HOME || '.', 'Applications', 'agent-plans-smoke'),
    timeoutSec:
      typeof flags['timeout-sec'] === 'string' && /^\d+$/.test(flags['timeout-sec'])
        ? Number(flags['timeout-sec'])
        : 20,
    autoAllow: flags['auto-allow'] !== false,
    keepInstall: flags['keep-install'] === true,
  };
}

function printHelp() {
  process.stdout.write(`release-smoke\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  pnpm release:smoke\n`);
  process.stdout.write(`  pnpm release:smoke -- --dmg <path>\n`);
  process.stdout.write(`  pnpm release:smoke -- --url <url>\n\n`);
  process.stdout.write(`Flags:\n`);
  process.stdout.write(`  --dmg <path>         Local DMG path\n`);
  process.stdout.write(`  --url <url>          Remote DMG URL\n`);
  process.stdout.write(
    `  --install-dir <path> Install destination (default: ~/Applications/agent-plans-smoke)\n`
  );
  process.stdout.write(`  --timeout-sec <n>    Launch wait timeout in seconds (default: 20)\n`);
  process.stdout.write(`  --no-auto-allow      Disable automatic quarantine removal and retry\n`);
  process.stdout.write(`  --keep-install       Keep installed test app after run\n`);
  process.stdout.write(`  --help               Show help\n`);
}

async function runShell(command, cwd = process.cwd()) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
  });
}

function quote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

async function findRepoRoot(cwd) {
  const result = await runShell('git rev-parse --show-toplevel', cwd);
  if (result.code !== 0) {
    throw new Error(`Not a git repository: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

async function findNewestLocalDmg(repoRoot) {
  const releaseDir = resolve(repoRoot, 'apps/electron/release');
  if (!existsSync(releaseDir)) {
    return null;
  }

  const files = await readdir(releaseDir);
  const dmgs = [];
  for (const file of files) {
    if (!file.endsWith('.dmg')) continue;
    const fullPath = join(releaseDir, file);
    const info = await stat(fullPath);
    dmgs.push({ path: fullPath, mtimeMs: info.mtimeMs });
  }

  if (dmgs.length === 0) return null;
  dmgs.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return dmgs[0].path;
}

async function resolveDmgPath(config, repoRoot, workDir) {
  if (config.dmg) {
    const resolved = resolve(process.cwd(), config.dmg);
    if (!existsSync(resolved)) {
      throw new Error(`DMG not found: ${resolved}`);
    }
    return resolved;
  }

  if (config.url) {
    const targetPath = join(workDir, 'downloaded.dmg');
    const command = `curl -fL ${quote(config.url)} -o ${quote(targetPath)}`;
    const result = await runShell(command, repoRoot);
    if (result.code !== 0) {
      throw new Error(`Failed to download DMG: ${result.stderr || result.stdout}`);
    }
    return targetPath;
  }

  const local = await findNewestLocalDmg(repoRoot);
  if (!local) {
    throw new Error('No DMG found. Provide --dmg <path> or --url <url>.');
  }
  return local;
}

async function attachDmg(dmgPath, repoRoot) {
  const command = `hdiutil attach ${quote(dmgPath)} -nobrowse -readonly`;
  const result = await runShell(command, repoRoot);
  if (result.code !== 0) {
    throw new Error(`Failed to mount DMG: ${result.stderr || result.stdout}`);
  }

  const lines = result.stdout.split('\n').map((line) => line.trim());
  const mountLine = lines.reverse().find((line) => line.includes('/Volumes/'));
  if (!mountLine) {
    throw new Error(`Could not detect mount point from hdiutil output:\n${result.stdout}`);
  }

  const mountPoint = mountLine.slice(mountLine.indexOf('/Volumes/')).trim();
  return mountPoint;
}

async function detachDmg(mountPoint, repoRoot) {
  const result = await runShell(`hdiutil detach ${quote(mountPoint)} -force`, repoRoot);
  if (result.code !== 0) {
    process.stderr.write(
      `[release-smoke] failed to detach ${mountPoint}: ${result.stderr || result.stdout}\n`
    );
  }
}

async function findAppInMount(mountPoint, repoRoot) {
  const command = `find ${quote(mountPoint)} -maxdepth 2 -name '*.app' -type d | head -n 1`;
  const result = await runShell(command, repoRoot);
  if (result.code !== 0 || !result.stdout.trim()) {
    throw new Error(`No .app bundle found in mounted DMG: ${mountPoint}`);
  }
  return result.stdout.trim();
}

async function copyApp(sourceApp, installDir, repoRoot) {
  await mkdir(installDir, { recursive: true });
  const targetApp = join(installDir, basename(sourceApp));

  await rm(targetApp, { recursive: true, force: true });

  const copyResult = await runShell(`ditto ${quote(sourceApp)} ${quote(targetApp)}`, repoRoot);
  if (copyResult.code !== 0) {
    throw new Error(`Failed to copy app: ${copyResult.stderr || copyResult.stdout}`);
  }

  return targetApp;
}

async function readQuarantine(targetApp, repoRoot) {
  const result = await runShell(`xattr -p com.apple.quarantine ${quote(targetApp)}`, repoRoot);
  if (result.code !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

async function spctlStatus(targetApp, repoRoot) {
  const result = await runShell(`spctl -a -vvv ${quote(targetApp)}`, repoRoot);
  return {
    code: result.code,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

async function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

async function isRunning(targetApp, repoRoot) {
  const byName = await runShell('pgrep -x agent-plans', repoRoot);
  if (byName.code === 0 && byName.stdout.trim()) {
    return true;
  }

  const byPath = await runShell(`pgrep -f ${quote(`${targetApp}/Contents/MacOS`)}`, repoRoot);
  return byPath.code === 0 && byPath.stdout.trim().length > 0;
}

async function waitForLaunch(targetApp, repoRoot, timeoutSec) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutSec * 1000) {
    // eslint-disable-next-line no-await-in-loop
    const running = await isRunning(targetApp, repoRoot);
    if (running) return true;
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
  }
  return false;
}

async function openApp(targetApp, repoRoot, timeoutSec) {
  const openResult = await runShell(`open -n ${quote(targetApp)}`, repoRoot);
  const launched = await waitForLaunch(targetApp, repoRoot, timeoutSec);
  return {
    launched,
    openCode: openResult.code,
    openStdout: openResult.stdout.trim(),
    openStderr: openResult.stderr.trim(),
  };
}

async function clearQuarantine(targetApp, repoRoot) {
  const result = await runShell(`xattr -dr com.apple.quarantine ${quote(targetApp)}`, repoRoot);
  return {
    success: result.code === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

async function quitApp(repoRoot) {
  await runShell('osascript -e \'tell application "agent-plans" to quit\'', repoRoot);
  await sleep(1000);
  await runShell('pkill -x agent-plans || true', repoRoot);
}

async function collectLogs(repoRoot) {
  const result = await runShell(
    'log show --last 2m --style compact --predicate \'process == "agent-plans"\'',
    repoRoot
  );
  if (result.code !== 0) {
    return null;
  }
  return result.stdout.trim();
}

async function main() {
  if (!IS_MAC) {
    throw new Error('release-smoke supports only macOS.');
  }

  const config = parseArgs(process.argv.slice(2));
  if (config.help) {
    printHelp();
    return;
  }
  const repoRoot = await findRepoRoot(process.cwd());
  const workDir = join('/tmp', `agent-plans-release-smoke-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  let mountPoint = null;
  let installedAppPath = null;

  const summary = {
    releaseSmokeVersion: 1,
    mode: config.autoAllow ? 'auto-allow' : 'manual',
    dmgPath: null,
    mountPoint: null,
    sourceAppPath: null,
    installedAppPath: null,
    gatekeeperLikelyBlocked: false,
    firstLaunch: null,
    secondLaunch: null,
    quarantineBefore: null,
    quarantineAfter: null,
    spctl: null,
    logs: null,
    success: false,
  };

  try {
    const dmgPath = await resolveDmgPath(config, repoRoot, workDir);
    summary.dmgPath = dmgPath;

    mountPoint = await attachDmg(dmgPath, repoRoot);
    summary.mountPoint = mountPoint;

    const sourceAppPath = await findAppInMount(mountPoint, repoRoot);
    summary.sourceAppPath = sourceAppPath;

    installedAppPath = await copyApp(sourceAppPath, config.installDir, repoRoot);
    summary.installedAppPath = installedAppPath;

    summary.quarantineBefore = await readQuarantine(installedAppPath, repoRoot);
    summary.spctl = await spctlStatus(installedAppPath, repoRoot);

    summary.firstLaunch = await openApp(installedAppPath, repoRoot, config.timeoutSec);
    summary.gatekeeperLikelyBlocked =
      !summary.firstLaunch.launched && summary.quarantineBefore !== null;

    if (!summary.firstLaunch.launched && config.autoAllow) {
      await clearQuarantine(installedAppPath, repoRoot);
      summary.quarantineAfter = await readQuarantine(installedAppPath, repoRoot);
      summary.secondLaunch = await openApp(installedAppPath, repoRoot, config.timeoutSec);
    }

    const launched = summary.secondLaunch?.launched || summary.firstLaunch.launched;
    summary.logs = await collectLogs(repoRoot);
    summary.success = Boolean(launched);

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    if (!summary.success) {
      process.exitCode = 1;
    }
  } finally {
    if (installedAppPath) {
      await quitApp(repoRoot);
    }

    if (mountPoint) {
      await detachDmg(mountPoint, repoRoot);
    }

    if (!config.keepInstall && config.installDir.includes('agent-plans-smoke')) {
      await rm(config.installDir, { recursive: true, force: true });
    }

    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${detail}\n`);
  process.exit(1);
});
