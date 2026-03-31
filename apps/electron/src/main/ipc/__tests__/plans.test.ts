import { beforeEach, describe, expect, it, vi } from 'vitest';
import { planService } from '../../services/planService.js';
import { registerPlansHandlers } from '../plans.js';

// Mock all services
vi.mock('../../services/planService.js', () => ({
  planService: {
    listPlans: vi.fn(),
    getPlan: vi.fn(),
    createPlan: vi.fn(),
    updatePlan: vi.fn(),
    deletePlan: vi.fn(),
    renamePlan: vi.fn(),
    updateStatus: vi.fn(),
    updateFrontmatterField: vi.fn(),
    bulkDelete: vi.fn(),
    getFilePath: vi.fn(),
  },
}));

vi.mock('../../services/subtaskService.js', () => ({
  subtaskService: {
    addSubtask: vi.fn(),
    updateSubtask: vi.fn(),
    deleteSubtask: vi.fn(),
    toggleSubtask: vi.fn(),
  },
}));

vi.mock('../../services/openerService.js', () => ({
  openerService: {
    openFile: vi.fn(),
  },
}));

vi.mock('../../services/exportService.js', () => ({
  exportService: {},
}));

const mockFindSessionsForPlan = vi.fn().mockResolvedValue([]);

vi.mock('../../services/sessionResumeService.js', () => ({
  SessionResumeService: vi.fn().mockImplementation(() => ({
    findSessionsForPlan: mockFindSessionsForPlan,
  })),
}));

describe('Plans IPC Handlers', () => {
  const mockIpcMain = {
    handle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registerPlansHandlers(mockIpcMain as unknown as Electron.IpcMain);
  });

  it('should register plans:list handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:list', expect.any(Function));
  });

  it('should register plans:get handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:get', expect.any(Function));
  });

  it('should register plans:create handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:create', expect.any(Function));
  });

  it('should register plans:update handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:update', expect.any(Function));
  });

  it('should register plans:delete handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:delete', expect.any(Function));
  });

  it('should register plans:rename handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:rename', expect.any(Function));
  });

  it('should register plans:updateStatus handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:updateStatus', expect.any(Function));
  });

  it('should register plans:updateMetadata handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:updateMetadata', expect.any(Function));
  });

  it('should register plans:updateFrontmatter handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      'plans:updateFrontmatter',
      expect.any(Function)
    );
  });

  it('should register subtask handlers', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:addSubtask', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:updateSubtask', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:deleteSubtask', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:toggleSubtask', expect.any(Function));
  });

  it('should register bulk operation handlers', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:bulkDelete', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:bulkStatus', expect.any(Function));
  });

  it('should register plans:open handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:open', expect.any(Function));
  });

  it('should register plans:availableTransitions handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      'plans:availableTransitions',
      expect.any(Function)
    );
  });

  it('should register plans:getResumeCommand handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:getResumeCommand', expect.any(Function));
  });

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(18);
  });

  describe('plans:getResumeCommand handler', () => {
    function getHandler(channel: string) {
      const call = mockIpcMain.handle.mock.calls.find(([ch]: [string]) => ch === channel);
      return call?.[1];
    }

    const validSessionId = '01234567-89ab-cdef-0123-456789abcdef';

    it('returns command from metadata when sessionId and projectPath are present', async () => {
      const handler = getHandler('plans:getResumeCommand');
      vi.mocked(planService.getPlan).mockResolvedValue({
        metadata: {
          sessionId: validSessionId,
          projectPath: '/home/user/project',
        },
      } as Awaited<ReturnType<typeof planService.getPlan>>);

      const result = await handler({}, 'test-plan.md');
      expect(result).toContain('claude --resume');
      expect(result).toContain(validSessionId);
      expect(result).toContain('/home/user/project');
    });

    it('falls back to JSONL scan when metadata lacks session info', async () => {
      const handler = getHandler('plans:getResumeCommand');
      vi.mocked(planService.getPlan).mockResolvedValue({
        metadata: { status: 'in_progress' },
      } as Awaited<ReturnType<typeof planService.getPlan>>);
      mockFindSessionsForPlan.mockResolvedValueOnce([
        {
          sessionId: validSessionId,
          cwd: '/home/user/fallback',
          filePath: '/tmp/test.jsonl',
          mtimeMs: Date.now(),
        },
      ]);

      const result = await handler({}, 'test-plan.md');
      expect(result).toContain('claude --resume');
      expect(result).toContain(validSessionId);
      expect(result).toContain('/home/user/fallback');
    });

    it('returns null when neither metadata nor JSONL have session info', async () => {
      const handler = getHandler('plans:getResumeCommand');
      vi.mocked(planService.getPlan).mockResolvedValue({
        metadata: { status: 'todo' },
      } as Awaited<ReturnType<typeof planService.getPlan>>);
      mockFindSessionsForPlan.mockResolvedValueOnce([]);

      const result = await handler({}, 'test-plan.md');
      expect(result).toBeNull();
    });

    it('falls through to JSONL when metadata sessionId is invalid', async () => {
      const handler = getHandler('plans:getResumeCommand');
      vi.mocked(planService.getPlan).mockResolvedValue({
        metadata: {
          sessionId: 'invalid; rm -rf /',
          projectPath: '/home/user/project',
        },
      } as Awaited<ReturnType<typeof planService.getPlan>>);
      mockFindSessionsForPlan.mockResolvedValueOnce([
        {
          sessionId: validSessionId,
          cwd: '/home/user/project',
          filePath: '/tmp/test.jsonl',
          mtimeMs: Date.now(),
        },
      ]);

      const result = await handler({}, 'test-plan.md');
      expect(result).toContain('claude --resume');
      expect(result).toContain(validSessionId);
    });
  });
});
