/**
 * Validation pattern for session IDs.
 * Accepts UUID/hex strings (20+ hex chars with hyphens) or agent-prefixed IDs.
 */
const SESSION_ID_PATTERN = /^(?:[0-9a-f-]{20,}|agent-[0-9a-z][0-9a-z-]*)$/;

/**
 * Check whether a string looks like a valid Claude Code session ID.
 */
export function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id);
}

/**
 * Shell-escape a path using single quotes.
 * Internal single quotes are escaped as `'\''`.
 */
function shellEscapeCwd(cwd: string): string {
  return `'${cwd.replace(/'/g, "'\\''")}'`;
}

/**
 * Build a shell command to resume a Claude Code session.
 * Returns null if the session ID fails validation.
 */
export function buildResumeCommand(sessionId: string, cwd: string): string | null {
  if (!isValidSessionId(sessionId)) {
    return null;
  }
  return `cd ${shellEscapeCwd(cwd)} && claude --resume ${sessionId}`;
}
