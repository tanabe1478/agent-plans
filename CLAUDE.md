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
```

### API (apps/api)

- **エントリポイント**: `src/index.ts` - Fastifyサーバー設定
- **ルート**: `/api/plans/*`, `/api/search`
- **サービス層**:
  - `PlanService`: プランファイルのCRUD操作（`~/.claude/plans/`を操作）
  - `SearchService`: 全文検索
  - `openerService`: 外部アプリ（VSCode, Terminal）での開く機能
  - `nameGenerator`: `adjective-verb-noun.md`形式のファイル名生成

- **設定**: `src/config.ts` で環境変数設定（PLANS_DIR, PORT等）
- **セキュリティ**: ファイル名バリデーションでパストラバーサル対策済み

### Web (apps/web)

- **状態管理**: Zustand（`stores/planStore.ts`, `stores/uiStore.ts`）
- **データ取得**: TanStack Query（`lib/hooks/usePlans.ts`, `lib/hooks/useSearch.ts`）
- **ルーティング**: React Router
  - `/` - プラン一覧
  - `/plan/:filename` - プラン詳細表示
  - `/search` - 検索
- **UI**: Tailwind CSS + lucide-react アイコン

### 共有パッケージ (packages/shared)

`@ccplans/shared` として api/web 両方から参照。型定義のみで実装コードなし。
- `PlanMeta`: ファイルメタデータ（filename, title, sections, preview等）
- `PlanDetail`: メタデータ + content
- API リクエスト/レスポンス型

## データフロー

1. APIがローカルの `~/.claude/plans/*.md` ファイルを直接読み書き
2. 削除時はデフォルトで `archive/` サブディレクトリへ移動（ソフトデリート）
3. タイトルはMarkdownの最初のH1から抽出、セクションはH2から抽出

## Conventions

- **Language**: Write all code comments, commit messages, and PR descriptions in English
