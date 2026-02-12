# Electron Testing Research Report

**Date**: 2025-02-12
**Purpose**: TDD and testing strategies for Electron applications

## Executive Summary

- **Spectron is deprecated** (since Feb 2022) - DO NOT USE
- **Playwright** is the recommended E2E testing tool for Electron in 2025
- **Vitest** is preferred over Jest for unit testing (faster, Vite-native, Jest-compatible API)
- Main process and renderer process require different testing strategies

---

## 1. Recommended Testing Frameworks

### Unit Testing: Vitest (Recommended)

| Feature | Vitest | Jest |
|---------|--------|------|
| Speed | Fast (native ESM) | Slower |
| Vite Integration | Native | Requires config |
| Jest Compatibility | Yes (drop-in) | N/A |
| Watch Mode | Fast HMR | Slower |
| TypeScript | Built-in | Requires ts-jest |

**Why Vitest for Electron:**
- Jest-compatible API makes migration easy
- Works even without Vite as build tool
- Faster test execution with native ESM support
- Better DX with instant feedback

### E2E Testing: Playwright (Recommended)

**Why Playwright over Spectron:**
- Spectron was officially deprecated February 1, 2022
- Playwright can hook directly into Electron launch process
- Headless mode support for faster CI/CD
- Auto-wait mechanisms for reliable tests
- Better cross-browser support if needed
- Active development and community support

---

## 2. Testing Main Process vs Renderer Process

### Main Process Testing

The main process runs in a Node.js environment and handles:
- Window management
- Native APIs
- IPC communication
- File system access

**Strategy:**

```typescript
// vitest.config.main.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts'],
    // Mock electron module for isolation
  }
})
```

**Key Approaches:**
1. **Mock the `electron` module** for isolated unit tests
2. Test business logic separately from Electron APIs
3. Use dependency injection for testable code
4. Test IPC handlers independently

```typescript
// Example: Testing IPC handler
import { describe, it, expect, vi } from 'vitest'

describe('IPC Handlers', () => {
  it('should handle get-user-data', async () => {
    const mockEvent = {} as any
    const result = await handleGetUserData(mockEvent, 'user-id')
    expect(result).toEqual({ id: 'user-id', name: 'Test' })
  })
})
```

### Renderer Process Testing

The renderer process runs in a browser environment (Chromium) and handles:
- UI rendering
- User interactions
- DOM manipulation

**Strategy:**

```typescript
// vitest.config.renderer.ts
export default defineConfig({
  test: {
    environment: 'jsdom', // or 'happy-dom'
    include: ['src/renderer/**/*.test.tsx'],
    setupFiles: ['./src/renderer/test-setup.ts'],
  }
})
```

**Key Approaches:**
1. Use `jsdom` or `happy-dom` for DOM simulation
2. Test React components with Testing Library
3. Mock IPC communication (`contextBridge` / `ipcRenderer`)
4. Test UI state and user interactions

```typescript
// Example: Testing renderer component
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock electron APIs
vi.mock('@electron/remote', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
  },
}))

describe('PlanList', () => {
  it('should render plans from IPC', async () => {
    render(<PlanList />)
    expect(await screen.findByText('Test Plan')).toBeInTheDocument()
  })
})
```

---

## 3. E2E Testing with Playwright

### Setup

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    // Electron-specific config
  },
})
```

### Launching Electron App

```typescript
// e2e/app.spec.ts
import { _electron as electron } from '@playwright/test'
import { test, expect } from '@playwright/test'

test('app launches and displays plans', async () => {
  const electronApp = await electron.launch({
    args: ['.'], // path to electron app
  })

  const window = await electronApp.firstWindow()
  await expect(window.locator('h1')).toContainText('Plans')

  await electronApp.close()
})
```

### Best Practices

1. **Isolate tests** - Each test should launch fresh app instance
2. **Use data-testid** - For reliable element selection
3. **Mock external dependencies** - File system, network calls
4. **Test critical user flows** - Focus on happy paths + edge cases
5. **Screenshot comparisons** - For visual regression

---

## 4. Coverage Strategies

### Recommended Coverage Targets

| Layer | Target | Notes |
|-------|--------|-------|
| Main Process | 80%+ | Focus on IPC handlers, business logic |
| Renderer Components | 70%+ | Focus on user interactions |
| E2E | Critical paths | Cover main user flows |

### Vitest Coverage Setup

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
})
```

### Combined Coverage

For combined main + renderer coverage, run separate configs and merge:

```bash
vitest run --config vitest.config.main.ts --coverage
vitest run --config vitest.config.renderer.ts --coverage
# Use coverage merger tools
```

---

## 5. TDD Workflow for Electron

### Recommended Workflow

```
1. WRITE TEST (Red)
   ├── For main process: Test IPC handler / business logic
   └── For renderer: Test component behavior / user interaction

2. RUN TEST (Fail)
   └── Verify test fails for right reason

3. WRITE CODE (Green)
   ├── Implement minimal code to pass
   └── Don't worry about perfection

4. RUN TEST (Pass)
   └── Confirm test passes

5. REFACTOR (Improve)
   ├── Clean up code
   ├── Add error handling
   └── Keep tests green

6. VERIFY COVERAGE
   └── Ensure 80%+ coverage maintained
```

### Project Structure for TDD

```
src/
├── main/
│   ├── ipc/
│   │   ├── handlers.ts
│   │   └── handlers.test.ts
│   ├── services/
│   │   ├── planService.ts
│   │   └── planService.test.ts
│   └── index.ts
├── renderer/
│   ├── components/
│   │   ├── PlanList.tsx
│   │   └── PlanList.test.tsx
│   └── hooks/
│       ├── usePlans.ts
│       └── usePlans.test.ts
└── shared/
    └── types.ts

e2e/
├── app-launch.spec.ts
├── plan-crud.spec.ts
└── search.spec.ts
```

---

## 6. Additional Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| @playwright/test | E2E testing | Native Electron support |
| vitest | Unit testing | Jest-compatible, fast |
| @testing-library/react | Component testing | For renderer UI |
| happy-dom / jsdom | DOM simulation | For renderer unit tests |
| electron-mock-ipc | Mock IPC | Isolate main/renderer |

---

## 7. CI/CD Considerations

```yaml
# Example GitHub Actions
- name: Run Unit Tests
  run: pnpm test

- name: Run E2E Tests
  run: pnpm test:e2e
  env:
    # Electron needs display
    DISPLAY: ':99'
```

**Notes:**
- E2E tests require display (use Xvfb on Linux)
- Consider parallelizing unit tests but not E2E
- Headless mode available in Playwright for Electron

---

## Sources

- [Electron Automated Testing](https://electronjs.org/docs/latest/tutorial/automated-testing)
- [Electron Testing Documentation](https://electronjs.org/docs/latest/development/testing)
- [Spectron Deprecation Notice](https://electronjs.org/blog/spectron-deprecation-notice)
- [Testing Electron Apps with Playwright](https://medium.com/kubeshop-i/testing-electron-apps-with-playwright-kubeshop-839ff27cf376)
- [Vitest Official Site](https://vitest.dev/)
- [Vitest Comparisons Guide](https://vitest.dev/guide/comparisons.html)
- [CircleCI Electron Testing Guide](https://circleci.com/blog/electron-testing/)
- [Reddit: Selenide vs Playwright for Electron](https://www.reddit.com/r/QualityAssurance/comments/1p5lxpg/selenide_vs_playwright_for_an_electron_app/)
- [DEV Community: Electron Testing Best Practices](https://dev.to/woovi/electron-testing-best-practices-testing-main-and-renderer-code-with-jest-4b5m)
- [iT邦幫忙: Electron單元測試與整合測試](https://ithelp.ithome.com.tw/m/articles/10367071)
