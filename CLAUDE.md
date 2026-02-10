# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

詳細は `codemaps/` ディレクトリを参照:

- `codemaps/architecture.md` - 全体構成、パッケージ依存、データフロー
- `codemaps/backend.md` - APIルート(10)、サービス(17)、ステータス遷移
- `codemaps/frontend.md` - ページ(10)、コンポーネントツリー、hooks、stores
- `codemaps/data.md` - 型定義、スキーマ、ファイルストレージ構成

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
- **ルート**: `/api/plans/*`, `/api/search`, `/api/views`, `/api/notifications`, `/api/archive`, `/api/dependencies`, `/api/templates`, `/api/export`, `/api/import`, `/api/admin`
- **サービス層**: 17モジュール（詳細は `codemaps/backend.md`）
  - `PlanService`: プランファイルのCRUD操作（`~/.claude/plans/`を操作）
  - `SearchService` / `queryParser`: 全文検索 + 高度なクエリ構文
  - `statusTransitionService`: ステータス遷移の検証
  - `historyService`: バージョン履歴・差分・ロールバック
  - `auditService`: 操作監査ログ
  - `dependencyService`: 依存関係グラフ・循環検出
- **設定**: `src/config.ts` で環境変数設定（PLANS_DIR, PORT等）
- **セキュリティ**: ファイル名バリデーションでパストラバーサル対策済み

### Web (apps/web)

- **状態管理**: Zustand（`stores/planStore.ts`, `stores/uiStore.ts`）
- **データ取得**: TanStack Query（10 hooks、詳細は `codemaps/frontend.md`）
- **ルーティング**: React Router（10ページ）
  - `/` - プラン一覧、`/plan/:filename` - 詳細、`/plan/:filename/review` - レビューモード
  - `/search`, `/kanban`, `/calendar`, `/archive`, `/dependencies`, `/templates`, `/backups`
- **UI**: Tailwind CSS + lucide-react アイコン
- **レビューモード**: GitHub diff風プレーンテキスト表示、インラインコメント、Shift+Click範囲選択

### 共有パッケージ (packages/shared)

`@ccplans/shared` として api/web 両方から参照。型定義のみで実装コードなし。
詳細は `codemaps/data.md` を参照。

## データフロー

1. APIがローカルの `~/.claude/plans/*.md` ファイルを直接読み書き
2. 削除時はデフォルトで `archive/` サブディレクトリへ移動（ソフトデリート）
3. タイトルはMarkdownの最初のH1から抽出、セクションはH2から抽出
4. YAMLフロントマターからメタデータ（status, projectPath等）を解析
5. PostToolUseフック（`hooks/plan-metadata/inject.py`）でプラン作成時にfrontmatterを自動挿入
6. レビューコメントはlocalStorageに保存（プランごとのキー）

## Conventions

- **Language**: Write all code comments, commit messages, and PR descriptions in English
