# AGENTS.md

This file provides guidance to coding agents (e.g., Codex, Claude Code) when working with code in this repository.

## プロジェクト概要

Claude Plans Manager (ccplans) - `~/.claude/plans/` ディレクトリ内のプランファイル（Markdownファイル）を管理するWebベースのツール。pnpmワークスペースによるモノレポ構成。

## コマンド

```bash
# 開発サーバー起動（API + Web同時起動）
pnpm dev

# 全パッケージのビルド
pnpm build

# 全パッケージのテスト
pnpm test

# E2Eテスト（Playwright）
pnpm test:e2e

# 単一テストファイル実行
pnpm --filter @ccplans/api test -- planService.test.ts

# テスト（ウォッチモード）
pnpm --filter @ccplans/api test:watch

# 型チェック
pnpm --filter @ccplans/api lint
pnpm --filter @ccplans/web lint
```

## アーキテクチャ

### パッケージ構成

```
apps/
  api/     - Fastify REST API サーバー (port 3001)
  web/     - React SPA (Vite, port 5173)
packages/
  shared/  - 共有型定義（PlanMeta, PlanDetail, API型など）
e2e/       - Playwright E2Eテスト
hooks/     - Claude Code用hookスクリプト
```

### API (apps/api)

- **エントリポイント**: `src/index.ts` - Fastifyサーバー設定
- **ルート**: `/api/plans/*`, `/api/search`
- **サービス層**:
  - `PlanService`: プランファイルのCRUD操作（`~/.claude/plans/`を操作）
    - `updateStatus()`: ステータス更新（frontmatterを書き換え）
    - `parseFrontmatter()`: YAMLフロントマター解析
  - `SearchService`: 全文検索
  - `openerService`: 外部アプリ（VSCode, Terminal）での開く機能
  - `nameGenerator`: `adjective-verb-noun.md`形式のファイル名生成
- **ステータス更新API**: `PATCH /api/plans/:filename/status` でステータス変更

- **設定**: `src/config.ts` で環境変数設定（PLANS_DIR, PORT等）
- **セキュリティ**: ファイル名バリデーションでパストラバーサル対策済み

### Web (apps/web)

- **状態管理**: Zustand（`stores/planStore.ts`, `stores/uiStore.ts`）
  - `statusFilter`: ステータスでフィルター（todo, in_progress, completed, all）
  - `projectFilter`: プロジェクトパスでフィルター
- **データ取得**: TanStack Query（`lib/hooks/usePlans.ts`, `lib/hooks/useSearch.ts`）
  - `useUpdateStatus()`: ステータス更新用mutation
- **ルーティング**: React Router
  - `/` - プラン一覧（フィルター・ソート機能付き）
  - `/plan/:filename` - プラン詳細表示
  - `/search` - 検索
- **UI**: Tailwind CSS + lucide-react アイコン
- **ステータス関連コンポーネント**:
  - `StatusBadge`: ステータス表示バッジ（色分け）
  - `StatusDropdown`: ステータス変更ドロップダウン
  - `ProjectBadge`: プロジェクトパス表示

### 共有パッケージ (packages/shared)

`@ccplans/shared` として api/web 両方から参照。型定義のみで実装コードなし。
- `PlanMeta`: ファイルメタデータ（filename, title, sections, preview, frontmatter等）
- `PlanDetail`: メタデータ + content
- `PlanFrontmatter`: YAMLフロントマターの型（created, modified, projectPath, sessionId, status）
- `PlanStatus`: ステータス型（`'todo' | 'in_progress' | 'completed'`）
- API リクエスト/レスポンス型

## データフロー

1. APIがローカルの `~/.claude/plans/*.md` ファイルを直接読み書き
2. 削除時はデフォルトで `archive/` サブディレクトリへ移動（ソフトデリート）
3. タイトルはMarkdownの最初のH1から抽出、セクションはH2から抽出
4. YAMLフロントマターからメタデータ（status, projectPath等）を解析
5. PostToolUseフック（`hooks/plan-metadata/inject.py`）でプラン作成時にfrontmatterを自動挿入

## Conventions

- **Language**: Write all code comments, commit messages, and PR descriptions in English
