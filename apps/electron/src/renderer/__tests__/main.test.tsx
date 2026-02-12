import { describe, expect, it, vi } from 'vitest';

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: vi.fn(),
    on: vi.fn(() => vi.fn()),
  },
});

describe('Renderer Entry Point', () => {
  it('should have electronAPI available', () => {
    expect(window.electronAPI).toBeDefined();
    expect(window.electronAPI.invoke).toBeDefined();
  });
});
