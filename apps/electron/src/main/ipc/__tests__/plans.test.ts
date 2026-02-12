import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('../../services/statusTransitionService.js', () => ({
  statusTransitionService: {
    isValidTransition: vi.fn(() => true),
    getAvailableTransitions: vi.fn(() => ['in_progress', 'review', 'completed']),
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

vi.mock('../../services/historyService.js', () => ({
  historyService: {
    listVersions: vi.fn(),
    rollback: vi.fn(),
    getVersion: vi.fn(),
    computeDiff: vi.fn(),
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
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:bulkTags', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:bulkAssign', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:bulkPriority', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:bulkArchive', expect.any(Function));
  });

  it('should register history handlers', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:history', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:rollback', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:diff', expect.any(Function));
  });

  it('should register plans:open handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:open', expect.any(Function));
  });

  it('should register plans:export handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith('plans:export', expect.any(Function));
  });

  it('should register plans:availableTransitions handler', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      'plans:availableTransitions',
      expect.any(Function)
    );
  });

  it('should register all handlers exactly once', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(24);
  });
});
