import { describe, expect, it } from 'vitest';
import { buildResumeCommand, isValidSessionId } from '../resumeCommand.js';

describe('isValidSessionId', () => {
  it('accepts UUID/hex format (20+ chars)', () => {
    expect(isValidSessionId('01234567-89ab-cdef-0123-456789abcdef')).toBe(true);
    expect(isValidSessionId('abcdef1234567890abcdef')).toBe(true);
  });

  it('accepts agent-prefixed IDs', () => {
    expect(isValidSessionId('agent-a1b2c3d')).toBe(true);
    expect(isValidSessionId('agent-sub-123')).toBe(true);
  });

  it('rejects short strings', () => {
    expect(isValidSessionId('')).toBe(false);
    expect(isValidSessionId('abc')).toBe(false);
    expect(isValidSessionId('abc123')).toBe(false);
  });

  it('rejects shell metacharacters', () => {
    expect(isValidSessionId('; rm -rf /')).toBe(false);
    expect(isValidSessionId('$(malicious)')).toBe(false);
    expect(isValidSessionId('`whoami`')).toBe(false);
  });

  it('rejects path traversal', () => {
    expect(isValidSessionId('../../etc/passwd')).toBe(false);
  });
});

describe('buildResumeCommand', () => {
  const validUuid = '01234567-89ab-cdef-0123-456789abcdef';
  const validAgent = 'agent-a1b2c3d';

  it('generates cd + claude --resume command with single-quoted cwd', () => {
    const result = buildResumeCommand(validUuid, '/home/user/project');
    expect(result).toBe(`cd '/home/user/project' && claude --resume ${validUuid}`);
  });

  it('handles paths with spaces', () => {
    const result = buildResumeCommand(validUuid, '/home/user/my project');
    expect(result).toBe(`cd '/home/user/my project' && claude --resume ${validUuid}`);
  });

  it('escapes single quotes in cwd', () => {
    const result = buildResumeCommand(validUuid, "/home/user/it's a project");
    expect(result).toBe(`cd '/home/user/it'\\''s a project' && claude --resume ${validUuid}`);
  });

  it('neutralises dollar signs and backticks via single quoting', () => {
    const result = buildResumeCommand(validUuid, '/home/$(whoami)/`id`');
    expect(result).toBe(`cd '/home/$(whoami)/\`id\`' && claude --resume ${validUuid}`);
  });

  it('accepts agent-prefixed session IDs', () => {
    const result = buildResumeCommand(validAgent, '/home/user/project');
    expect(result).toBe(`cd '/home/user/project' && claude --resume ${validAgent}`);
  });

  it('returns null for invalid session ID', () => {
    expect(buildResumeCommand('; rm -rf /', '/home')).toBeNull();
    expect(buildResumeCommand('abc', '/home')).toBeNull();
    expect(buildResumeCommand('../../etc/passwd', '/home')).toBeNull();
    expect(buildResumeCommand('$(malicious)', '/home')).toBeNull();
  });
});
