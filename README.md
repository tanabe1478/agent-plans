# Claude Plans Manager (ccplans)

A web-based tool for managing Claude Code plan files stored in `~/.claude/plans/`.

## Features

- Browse and search plan files with full-text search
- View plans with Markdown rendering
- Create, edit, rename, and delete plans
- Open plans in external apps (VS Code, Terminal)
- Soft delete with archive support

## Prerequisites

- Node.js 20+
- pnpm 9+

## Getting Started

```bash
# Clone the repository
git clone https://github.com/tanabe1478/ccplans.git
cd ccplans

# Install dependencies
pnpm install

# Start development servers (API + Web)
pnpm dev
```

The web app will be available at http://localhost:5173 and the API at http://localhost:3001.

## Project Structure

```
apps/
  api/          # Fastify REST API server
  web/          # React SPA (Vite + Tailwind)
packages/
  shared/       # Shared TypeScript types
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Type check all packages |
| `pnpm format` | Format code with Prettier |

### Package-specific commands

```bash
# Run tests for a specific package
pnpm --filter @ccplans/api test

# Watch mode for tests
pnpm --filter @ccplans/api test:watch

# Run a single test file
pnpm --filter @ccplans/api test -- planService.test.ts
```

## Configuration

Environment variables (optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `HOST` | `0.0.0.0` | API server host |
| `PLANS_DIR` | `~/.claude/plans` | Directory containing plan files |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plans` | List all plans |
| GET | `/api/plans/:filename` | Get plan details |
| POST | `/api/plans` | Create a new plan |
| PUT | `/api/plans/:filename` | Update a plan |
| DELETE | `/api/plans/:filename` | Delete a plan (archive) |
| POST | `/api/plans/:filename/rename` | Rename a plan |
| POST | `/api/plans/:filename/open` | Open in external app |
| GET | `/api/search?q=query` | Search plans |
| GET | `/api/health` | Health check |

## License

MIT
