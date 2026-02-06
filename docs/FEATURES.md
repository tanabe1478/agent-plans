# ccplans 機能仕様書

## 概要

ccplans (Claude Plans Manager) は `~/.claude/plans/` ディレクトリ内の Markdown プランファイルを管理する Web ベースツールです。Fastify REST API バックエンドと React SPA フロントエンドによるモノレポ構成で、全15機能を提供します。

---

## 機能一覧

### 1. Front Matter 標準項目拡張

YAML フロントマターに以下のフィールドが定義されています。

| フィールド | 型 | 説明 |
|---|---|---|
| `created` | `string` (ISO 8601) | 作成日時 |
| `modified` | `string` (ISO 8601) | 更新日時 |
| `projectPath` | `string` | プラン作成元のプロジェクトパス (YAML キー: `project_path`) |
| `sessionId` | `string` | Claude Code セッション ID (YAML キー: `session_id`) |
| `status` | `PlanStatus` | ステータス (`'todo' \| 'in_progress' \| 'review' \| 'completed'`) |
| `priority` | `PlanPriority` | 優先度 (`'low' \| 'medium' \| 'high' \| 'critical'`) |
| `dueDate` | `string` (ISO 8601) | 期限日 |
| `tags` | `string[]` | カテゴリ分類用タグ |
| `estimate` | `string` | 見積もり工数 (例: `"2h"`, `"3d"`, `"1w"`) |
| `blockedBy` | `string[]` | ブロッキングプランのファイル名リスト |
| `assignee` | `string` | 担当者 |
| `archivedAt` | `string` (ISO 8601) | アーカイブ日時 |
| `subtasks` | `Subtask[]` | サブタスクリスト |
| `schemaVersion` | `number` | スキーマバージョン (マイグレーション用) |

**使用例:**

```yaml
---
created: "2026-02-06T10:00:00.000Z"
modified: "2026-02-06T12:00:00.000Z"
project_path: "/home/user/project"
session_id: "abc-123"
status: in_progress
priority: high
dueDate: "2026-02-10T00:00:00.000Z"
tags:
  - "api"
  - "backend"
estimate: "3d"
blockedBy:
  - "design-plan.md"
assignee: "john"
schemaVersion: 1
subtasks:
  - id: "uuid-1"
    title: "API design"
    status: done
  - id: "uuid-2"
    title: "Implementation"
    status: todo
---
```

### 2. Front Matter バリデーションと自動補正

**実装:** `apps/api/src/services/validationService.ts`

Zod スキーマによるバリデーションと、不正値の自動補正を行います。

#### バリデーションルール一覧

| フィールド | ルール |
|---|---|
| `status` | `'todo' \| 'in_progress' \| 'review' \| 'completed'` のいずれか |
| `priority` | `'low' \| 'medium' \| 'high' \| 'critical'` のいずれか |
| `dueDate` | ISO 8601 datetime 形式 |
| `tags` | `string[]` 型 |
| `estimate` | 正規表現 `/^\d+[hdwm]$/` にマッチ (例: `1h`, `3d`, `2w`, `1m`) |
| `blockedBy` | `string[]` 型 |
| `assignee` | `string` 型 |
| `created` | ISO 8601 datetime 形式 |
| `modified` | ISO 8601 datetime 形式 |
| `archivedAt` | ISO 8601 datetime 形式 |
| `schemaVersion` | `number` 型 |
| `subtasks` | `{ id: string, title: string, status: 'todo' \| 'done', assignee?: string, dueDate?: string }[]` |

#### 自動補正ルール

| フィールド | 不正値の場合の補正 |
|---|---|
| `status` | 無効値 → `'todo'` |
| `priority` | 無効値 → `'medium'` |
| `dueDate` | パース不能 → 現在日時 (ISO 8601) |
| `tags` | 文字列 → 1要素配列、非配列 → 空配列 |
| `blockedBy` | 文字列 → 1要素配列、非配列 → 空配列 |
| `archivedAt` | パース不能 → 現在日時 (ISO 8601) |
| `schemaVersion` | 数値変換 (`Number()`) |

### 3. ステータス遷移ルール

**実装:** `apps/api/src/services/statusTransitionService.ts`, `packages/shared/src/types/plan.ts`

ステータス変更は定義された遷移ルールに従います。無効な遷移は API レベルで拒否されます。同じステータスへの遷移は常に許可されます。

#### 遷移図 (テキスト形式)

```
  todo ──────────→ in_progress
   ↑                   │  ↑
   │                   │  │
   │                   ↓  │
   │               review ──→ completed
   │                              │
   └──────────────────────────────┘
```

#### 許可/禁止遷移一覧

| From \ To | todo | in_progress | review | completed |
|---|---|---|---|---|
| **todo** | (same) | OK | NG | NG |
| **in_progress** | OK | (same) | OK | NG |
| **review** | NG | OK | (same) | OK |
| **completed** | OK | NG | NG | (same) |

- `isValidTransition(from, to)`: 遷移の可否を判定
- `getAvailableTransitions(current)`: 現在のステータスから遷移可能なステータスリストを返す

### 4. サブタスク管理

**実装:** `apps/api/src/services/subtaskService.ts`

プランのフロントマター内にサブタスクを管理します。

#### データ構造

```typescript
interface Subtask {
  id: string;       // UUID (自動生成)
  title: string;    // サブタスク名
  status: 'todo' | 'done';  // ステータス
  assignee?: string;  // 担当者 (任意)
  dueDate?: string;   // 期限 (任意)
}
```

#### API 使用方法

**エンドポイント:** `PATCH /api/plans/:filename/subtasks`

| アクション | リクエストボディ | 説明 |
|---|---|---|
| `add` | `{ action: "add", subtask: { title, status?, assignee?, dueDate? } }` | サブタスクを追加 (ID は自動生成) |
| `update` | `{ action: "update", subtaskId: "...", subtask: { title?, status?, assignee?, dueDate? } }` | サブタスクを部分更新 |
| `delete` | `{ action: "delete", subtaskId: "..." }` | サブタスクを削除 |
| `toggle` | `{ action: "toggle", subtaskId: "..." }` | ステータスを todo ↔ done トグル |

**進捗計算:** `getSubtaskProgress(subtasks)` で `{ done, total, percentage }` を取得可能。

### 5. 一括操作

**実装:** `apps/api/src/routes/plans.ts` (一括操作エンドポイント群)

複数プランに対する一括操作をサポートします。全ての一括操作は `BulkOperationResponse` 形式で、成功/失敗を個別に報告します。

#### サポートする操作一覧

| エンドポイント | メソッド | 説明 | リクエストボディ |
|---|---|---|---|
| `/api/plans/bulk-delete` | POST | 一括削除 | `{ filenames: string[] }` + `?permanent=true` |
| `/api/plans/bulk-status` | POST | 一括ステータス変更 | `{ filenames: string[], status: PlanStatus }` |
| `/api/plans/bulk-tags` | POST | 一括タグ追加/削除 | `{ filenames: string[], action: "add" \| "remove", tags: string[] }` |
| `/api/plans/bulk-assign` | POST | 一括担当者変更 | `{ filenames: string[], assignee: string }` |
| `/api/plans/bulk-priority` | POST | 一括優先度変更 | `{ filenames: string[], priority: PlanPriority }` |
| `/api/plans/bulk-archive` | POST | 一括アーカイブ | `{ filenames: string[] }` |

**レスポンス形式:**

```typescript
interface BulkOperationResponse {
  succeeded: string[];   // 成功したファイル名
  failed: { filename: string; error: string }[];  // 失敗の詳細
}
```

注: 一括ステータス変更ではステータス遷移ルールが個別に検証されます。無効な遷移のファイルは `failed` に含まれます。

### 6. 高度検索

**実装:** `apps/api/src/services/queryParser.ts`, `apps/api/src/services/searchService.ts`

構造化フィルターとフリーテキスト検索を組み合わせた高度な検索機能です。

#### クエリ構文リファレンス

**フィルターフィールド:**

| フィールド | 対応する frontmatter | サポート演算子 |
|---|---|---|
| `status` | `status` | `:`, `=` |
| `priority` | `priority` | `:`, `=` |
| `assignee` | `assignee` | `:` (部分一致), `=` (完全一致) |
| `tag` | `tags[]` | `:` (部分一致), `=` (完全一致) |
| `due` | `dueDate` | `=`, `<`, `>`, `<=`, `>=` |
| `estimate` | `estimate` | `:` (部分一致), `=` (完全一致) |
| `project` | `projectPath` | `:` (部分一致), `=` (完全一致) |
| `blockedBy` | `blockedBy[]` | `:` (部分一致), `=` (完全一致) |

**演算子:**

| 演算子 | 意味 |
|---|---|
| `:` | 等価またはcontains (フィールドによる) |
| `=` | 完全一致 |
| `<`, `>`, `<=`, `>=` | 比較 (日付フィールドで使用) |

**引用符:** ダブルクォートまたはシングルクォートで囲むとフレーズ検索。

#### 使用例

```
status:in_progress priority:high          # ステータスとpriority でフィルタ
tag:api due<2026-02-10                    # タグと期限でフィルタ
assignee:john "login feature"             # 担当者フィルタ + フリーテキスト
project:/home/user/myproject              # プロジェクトパスでフィルタ
```

**エンドポイント:** `GET /api/search?q=<query>&limit=50`

フィルターのみ (テキスト部分なし) の場合、条件に合致する全プランを返します。テキスト検索はファイル全体の行に対して大文字小文字区別なしのマッチングを行い、マッチ行のコンテキスト (前後20文字) をハイライト付きで返します。結果は最大10マッチ/ファイル、デフォルト50件まで返却されます。

### 7. 保存済みビュー

**実装:** `apps/api/src/services/viewService.ts`, `apps/api/src/routes/views.ts`

フィルター条件を保存して再利用できるビュー機能です。プリセットビューとカスタムビューの2種類があります。

#### プリセットビュー一覧

| ID | 名前 | フィルター条件 |
|---|---|---|
| `preset-in-progress` | In Progress | `{ status: 'in_progress' }` |
| `preset-high-priority` | High Priority | `{ priority: 'high' }` |
| `preset-critical` | Critical | `{ priority: 'critical' }` |
| `preset-todo` | Todo | `{ status: 'todo' }` |

#### カスタムビュー作成方法

**エンドポイント:** `POST /api/views`

```json
{
  "name": "My View",
  "filters": {
    "status": "in_progress",
    "priority": "high",
    "tags": ["api"],
    "assignee": "john",
    "dueBefore": "2026-03-01",
    "dueAfter": "2026-02-01",
    "searchQuery": "login"
  },
  "sortBy": "dueDate",
  "sortOrder": "asc"
}
```

**フィルター項目:**

| フィールド | 型 | 説明 |
|---|---|---|
| `status` | `PlanStatus \| 'all'` | ステータスフィルター |
| `priority` | `PlanPriority` | 優先度フィルター |
| `tags` | `string[]` | タグフィルター |
| `assignee` | `string` | 担当者フィルター |
| `dueBefore` | `string` | 期限上限 |
| `dueAfter` | `string` | 期限下限 |
| `searchQuery` | `string` | テキスト検索クエリ |

ビューデータは `~/.claude/plans/.views.json` に JSON 形式で永続化されます。

### 8. 期限管理ビュー

**実装:** `packages/shared/src/types/plan.ts` (型定義)

プランの表示モードとして3種類が定義されています。

#### ビューモード

```typescript
type ViewMode = 'list' | 'kanban' | 'calendar';
```

| モード | 説明 |
|---|---|
| `list` | リスト表示 |
| `kanban` | ステータスごとのカンバンボード |
| `calendar` | カレンダー表示 |

#### 期限カテゴリ分類

```typescript
interface DeadlineCategory {
  overdue: PlanMeta[];    // 期限超過
  today: PlanMeta[];      // 本日期限
  thisWeek: PlanMeta[];   // 今週中
  later: PlanMeta[];      // それ以降
  noDueDate: PlanMeta[];  // 期限未設定
}
```

### 9. 通知・リマインダー

**実装:** `apps/api/src/services/notificationService.ts`, `apps/api/src/routes/notifications.ts`

プランの状態に基づいて自動的に通知を生成します。通知の既読状態は `~/.claude/plans/.notifications-read.json` に永続化されます。

#### 通知トリガー一覧

| 通知タイプ | 条件 | 重要度 | メッセージ例 |
|---|---|---|---|
| `overdue` | 期限超過 (status != completed) | `critical` | `"Plan Title" is overdue (due 2026-02-01)` |
| `due_soon` | 本日期限 (status != completed) | `warning` | `"Plan Title" is due today` |
| `due_soon` | 明日期限 (status != completed) | `info` | `"Plan Title" is due tomorrow` |
| `blocked_stale` | in_progress + blockedBy あり + 3日以上未更新 | `warning` | `"Plan Title" is blocked and hasn't been updated in 3+ days` |

**通知の並び順:** severity 降順 (critical → warning → info)、同一 severity 内は作成日時降順。

**通知 ID:** `md5(type + planFilename + date)` の先頭12文字で生成。同一条件では同じ ID となり重複を防止。

### 10. 履歴・差分・ロールバック

**実装:** `apps/api/src/services/historyService.ts`

プランの変更履歴を自動保存し、差分表示とロールバックを提供します。

#### 履歴管理の仕組み

- **保存場所:** `~/.claude/plans/.history/<filename>/` ディレクトリ配下
- **ファイル名形式:** `<ISO 8601タイムスタンプ>.md` (コロンはハイフンに置換)
- **保存タイミング:** プランの更新、ステータス変更、ロールバック前に自動保存
- **最大バージョン数:** 50件 (超過分は古い順に自動削除)
- **差分アルゴリズム:** LCS (Longest Common Subsequence) ベースの行単位 diff

#### 差分結果

```typescript
interface DiffResult {
  oldVersion: string;
  newVersion: string;
  lines: DiffLine[];  // { type: 'added'|'removed'|'unchanged', content, lineNumber }
  stats: { added: number; removed: number; unchanged: number };
}
```

#### ロールバック

ロールバック実行時は現在の内容を「Before rollback」として自動保存してから、指定バージョンの内容で上書きします。

### 11. 誤削除対策の強化

**実装:** `apps/api/src/services/archiveService.ts`, `apps/api/src/routes/archive.ts`

削除されたプランのアーカイブ管理と復元機能を提供します。

#### アーカイブ管理

- **アーカイブ先:** `~/.claude/plans/archive/` ディレクトリ
- **メタデータ:** `archive/.meta.json` にアーカイブ情報を記録
- **保持期間:** デフォルト30日 (環境変数 `ARCHIVE_RETENTION_DAYS` で変更可能)
- **有効期限切れクリーンアップ:** `POST /api/archive/cleanup` で期限切れアーカイブを一括削除

#### アーカイブメタデータ

```typescript
interface ArchivedPlan {
  filename: string;      // ファイル名
  originalPath: string;  // 元のファイルパス
  archivedAt: string;    // アーカイブ日時
  expiresAt: string;     // 有効期限
  title: string;         // プランタイトル
  preview: string;       // プレビューテキスト
}
```

#### 削除の動作

- `DELETE /api/plans/:filename`: デフォルトでアーカイブ (ソフトデリート)
- `DELETE /api/plans/:filename?permanent=true`: 永久削除 (ハードデリート)
- `POST /api/archive/:filename/restore`: アーカイブからの復元
- `DELETE /api/archive/:filename`: アーカイブの完全削除

### 12. テンプレート機能

**実装:** `apps/api/src/services/templateService.ts`, `apps/api/src/routes/templates.ts`

プランのテンプレートを管理し、テンプレートからプランを作成できます。

#### プリセットテンプレート一覧

| 名前 | 表示名 | カテゴリ | デフォルトステータス | デフォルト優先度 | デフォルトタグ |
|---|---|---|---|---|---|
| `research` | Research | research | todo | medium | `["research"]` |
| `implementation` | Implementation | implementation | todo | medium | `["implementation"]` |
| `refactor` | Refactor | refactor | todo | medium | `["refactor"]` |
| `incident` | Incident | incident | in_progress | critical | `["incident"]` |

**テンプレートカテゴリ:** `'research' | 'implementation' | 'refactor' | 'incident' | 'custom'`

#### テンプレートの構造

```typescript
interface PlanTemplate {
  name: string;           // ファイル名 (拡張子なし)
  displayName: string;    // 表示名
  description: string;    // 説明
  category: TemplateCategory;
  content: string;        // テンプレート本文 ({{title}} プレースホルダー使用可)
  frontmatter: Partial<PlanFrontmatter>;  // デフォルト frontmatter
  isBuiltIn: boolean;     // ビルトインかカスタムか
}
```

#### カスタムテンプレート

- **保存場所:** `~/.claude/plans/.templates/` ディレクトリ
- ビルトインテンプレートの上書き・削除は不可
- テンプレート名は `/^[a-zA-Z0-9_-]+$/` にマッチする必要あり

#### テンプレートからのプラン作成

`POST /api/plans/from-template` または `POST /api/templates/from-template`

```json
{
  "templateName": "research",
  "title": "API Design Investigation",
  "filename": "api-research.md"
}
```

テンプレート本文中の `{{title}}` がタイトルに置換され、frontmatter に `created` と `modified` が自動設定されます。

### 13. 依存関係の可視化

**実装:** `apps/api/src/services/dependencyService.ts`, `apps/api/src/routes/dependencies.ts`

プラン間の `blockedBy` フィールドに基づく依存関係グラフを構築・分析します。

#### グラフの読み方

**ノード (DependencyNode):**

```typescript
interface DependencyNode {
  filename: string;     // プランファイル名
  title: string;        // タイトル
  status: PlanStatus;   // ステータス
  blockedBy: string[];  // このプランがブロックされているプランのリスト
  blocks: string[];     // このプランがブロックしているプランのリスト (自動計算)
}
```

**エッジ (DependencyEdge):**

```typescript
interface DependencyEdge {
  from: string;  // ブロッカー (blockedBy の要素)
  to: string;    // ブロックされているプラン
}
```

**グラフ全体 (DependencyGraph):**

```typescript
interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  hasCycle: boolean;       // 循環依存の有無
  criticalPath: string[];  // 最長依存チェーン (循環がない場合のみ)
}
```

**機能:**

- **循環依存検出:** DFS (深さ優先探索) による循環検出
- **クリティカルパス:** トポロジカルソートによる最長依存チェーンの算出 (循環がある場合は空配列)
- **個別プランの依存情報:** `GET /api/dependencies/:filename` で上流・下流の依存関係チェーンを取得

### 14. インポート・エクスポート

**実装:** `apps/api/src/services/exportService.ts`, `apps/api/src/services/importService.ts`, `apps/api/src/routes/export.ts`, `apps/api/src/routes/import.ts`

#### エクスポート

**一括エクスポート:** `GET /api/export?format=json|csv|zip`

| フォーマット | Content-Type | 内容 |
|---|---|---|
| `json` | `application/json` | 全プランの frontmatter + content を含む JSON |
| `csv` | `text/csv` | メタデータのみ (filename, title, status, priority, dueDate, assignee, tags, created, modified) |
| `zip` | `application/gzip` | 全 Markdown ファイルを含む tar.gz アーカイブ |

**フィルターオプション (クエリパラメータ):**

| パラメータ | 説明 |
|---|---|
| `filterStatus` | ステータスでフィルター |
| `filterTags` | カンマ区切りのタグでフィルター |
| `includeArchived` | アーカイブを含める (`"true"`) |

**個別エクスポート:** `GET /api/plans/:filename/export?format=md|html`

| フォーマット | 説明 |
|---|---|
| `md` | Markdown ファイルをそのままダウンロード |
| `html` | 簡易 HTML に変換してダウンロード |
| `pdf` | 未実装 (501 応答) |

#### インポート

**Markdown インポート:** `POST /api/import/markdown`

```json
{
  "files": [
    { "filename": "plan-1.md", "content": "# Plan 1\n..." },
    { "filename": "plan-2.md", "content": "# Plan 2\n..." }
  ]
}
```

- 既存ファイルがある場合はスキップ (上書きなし)
- ファイル名バリデーション: `/^[a-zA-Z0-9_-]+\.md$/`

**レスポンス:**

```typescript
interface ImportResult {
  imported: number;   // インポート成功数
  skipped: number;    // スキップ数 (既存ファイル)
  errors: { filename: string; error: string }[];  // エラー詳細
}
```

#### バックアップ

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `POST /api/backup` | POST | バックアップ作成 |
| `GET /api/backups` | GET | バックアップ一覧 |
| `POST /api/backup/:id/restore` | POST | バックアップから復元 |

- **保存場所:** `~/.claude/plans/.backups/`
- **形式:** JSON ファイル (タイムスタンプベースのファイル名)
- **復元:** 既存ファイルはスキップ (上書きなし)

### 15. 品質・運用機能

#### スキーママイグレーション

**実装:** `apps/api/src/services/migrationService.ts`

- **現在のスキーマバージョン:** 1
- **マイグレーション v0 → v1:**
  - `schemaVersion: 1` を設定
  - `priority` フィールドの正規化
  - `tags` が文字列の場合は配列に変換
- **自動マイグレーション:** プランの取得時 (`getPlan`) に `needsMigration()` で確認し、必要に応じて自動マイグレーション
- **一括マイグレーション:** `POST /api/admin/migrate` で全プランを一括マイグレーション
- **スキーマバージョン確認:** `GET /api/admin/schema-version`

**マイグレーション結果:**

```typescript
interface MigrationResult {
  migrated: number;  // マイグレーションされたプラン数
  errors: string[];  // エラーメッセージ
}
```

#### 競合検知

**実装:** `apps/api/src/services/conflictService.ts`

- **仕組み:** ファイル読み取り時に `mtime` (最終更新日時) をキャッシュ。更新時にキャッシュと現在の `mtime` を比較し、外部からの変更を検出
- **検出閾値:** `mtime` の差が 1ms 以上
- **競合時の応答:** HTTP 409 Conflict

```typescript
interface ConflictInfo {
  hasConflict: boolean;
  lastKnownMtime?: number;
  currentMtime?: number;
  message?: string;  // "File was modified externally"
}
```

#### 監査ログ

**実装:** `apps/api/src/services/auditService.ts`

- **保存場所:** `~/.claude/plans/.audit.jsonl` (JSON Lines 形式)
- **記録方式:** 非ブロッキング (`catch(() => {})` で書き込みエラーは無視)

**監査エントリ:**

```typescript
interface AuditEntry {
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'restore' | 'rollback' | 'status_change' | 'bulk_operation';
  filename: string;
  details: Record<string, unknown>;
}
```

**記録される操作:**

| アクション | details に含まれる情報 |
|---|---|
| `create` | (なし) |
| `update` | `{ contentLength }` |
| `delete` | `{ permanent, archived }` |
| `status_change` | `{ from, to }` |

**監査ログの取得:** `GET /api/admin/audit?limit=100&filename=plan.md&action=update`

| パラメータ | 説明 |
|---|---|
| `limit` | 取得件数上限 |
| `filename` | ファイル名フィルター |
| `action` | アクション種別フィルター |

結果は新しい順にソートされます。

---

## API リファレンス

### プラン操作 (`/api/plans`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/plans` | 一覧取得 | - | `{ plans: PlanMeta[], total: number }` |
| GET | `/api/plans/:filename` | 詳細取得 | - | `PlanDetail` |
| POST | `/api/plans` | 新規作成 | `{ content, filename? }` | `PlanMeta` (201) |
| PUT | `/api/plans/:filename` | 更新 | `{ content }` | `PlanMeta` |
| DELETE | `/api/plans/:filename` | 削除 | `?permanent=true` で完全削除 | `{ success, message }` |
| POST | `/api/plans/:filename/rename` | リネーム | `{ newFilename }` | `PlanMeta` |
| PATCH | `/api/plans/:filename/status` | ステータス変更 | `{ status }` | `PlanMeta` |
| PATCH | `/api/plans/:filename/subtasks` | サブタスク操作 | `SubtaskActionRequest` | `{ success, subtask? }` |
| POST | `/api/plans/:filename/open` | 外部アプリで開く | `{ app: 'vscode' \| 'terminal' \| 'default' }` | `{ success, message }` |
| GET | `/api/plans/:filename/export` | 個別エクスポート | `?format=md\|html\|pdf` | ファイルダウンロード |
| POST | `/api/plans/from-template` | テンプレートから作成 | `{ templateName, title?, filename? }` | `PlanMeta` (201) |

### 一括操作 (`/api/plans`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| POST | `/api/plans/bulk-delete` | 一括削除 | `{ filenames }` + `?permanent=true` | `{ success, deleted }` |
| POST | `/api/plans/bulk-status` | 一括ステータス変更 | `{ filenames, status }` | `BulkOperationResponse` |
| POST | `/api/plans/bulk-tags` | 一括タグ操作 | `{ filenames, action, tags }` | `BulkOperationResponse` |
| POST | `/api/plans/bulk-assign` | 一括担当者変更 | `{ filenames, assignee }` | `BulkOperationResponse` |
| POST | `/api/plans/bulk-priority` | 一括優先度変更 | `{ filenames, priority }` | `BulkOperationResponse` |
| POST | `/api/plans/bulk-archive` | 一括アーカイブ | `{ filenames }` | `BulkOperationResponse` |

### 履歴・差分 (`/api/plans`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/plans/:filename/history` | バージョン一覧 | - | `{ versions: PlanVersion[], filename }` |
| GET | `/api/plans/:filename/history/:version` | バージョン取得 | - | `{ content, version, filename }` |
| POST | `/api/plans/:filename/rollback` | ロールバック | `{ version }` | `{ success, message }` |
| GET | `/api/plans/:filename/diff` | 差分取得 | `?from=<version>&to=<version>` | `DiffResult` |

### 検索 (`/api/search`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/search` | 検索 | `?q=<query>&limit=50` | `{ results: SearchResult[], query, total }` |

### ビュー (`/api/views`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/views` | 一覧取得 | - | `{ views: SavedView[] }` |
| POST | `/api/views` | 作成 | `CreateViewRequest` | `SavedView` (201) |
| PUT | `/api/views/:id` | 更新 | `UpdateViewRequest` | `SavedView` |
| DELETE | `/api/views/:id` | 削除 | - | `{ success, message }` |

### 通知 (`/api/notifications`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/notifications` | 一覧取得 | - | `{ notifications: Notification[], unreadCount }` |
| PATCH | `/api/notifications/:id/read` | 既読にする | - | `{ success }` |
| POST | `/api/notifications/mark-all-read` | 全て既読にする | - | `{ success }` |

### アーカイブ (`/api/archive`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/archive` | アーカイブ一覧 | - | `{ archived: ArchivedPlan[], total }` |
| POST | `/api/archive/:filename/restore` | 復元 | - | `{ success, message }` |
| DELETE | `/api/archive/:filename` | 完全削除 | - | `{ success, message }` |
| POST | `/api/archive/cleanup` | 期限切れクリーンアップ | - | `{ success, deleted }` |

### テンプレート (`/api/templates`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/templates` | 一覧取得 | - | `{ templates: PlanTemplate[] }` |
| GET | `/api/templates/:name` | 取得 | - | `PlanTemplate` |
| POST | `/api/templates` | 作成 | `CreateTemplateRequest` | `PlanTemplate` (201) |
| DELETE | `/api/templates/:name` | 削除 | - | `{ success, message }` |
| POST | `/api/templates/from-template` | テンプレートから作成 | `CreateFromTemplateRequest` | `PlanMeta` (201) |

### 依存関係 (`/api/dependencies`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/dependencies` | 全体グラフ | - | `DependencyGraph` |
| GET | `/api/dependencies/:filename` | 個別依存 | - | `PlanDependencies` |

### エクスポート (`/api/export`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/export` | 一括エクスポート | `?format=json\|csv\|zip&filterStatus=...&filterTags=...` | ファイルダウンロード |

### インポート (`/api/import`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| POST | `/api/import/markdown` | Markdown インポート | `{ files: [{filename, content}] }` | `ImportResult` |

### バックアップ (`/api/backup`, `/api/backups`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| POST | `/api/backup` | バックアップ作成 | - | `BackupInfo` (201) |
| GET | `/api/backups` | バックアップ一覧 | - | `{ backups: BackupInfo[] }` |
| POST | `/api/backup/:id/restore` | バックアップ復元 | - | `ImportResult` |

### 管理 (`/api/admin`)

| メソッド | パス | 説明 | リクエスト | レスポンス |
|---|---|---|---|---|
| GET | `/api/admin/audit` | 監査ログ取得 | `?limit=&filename=&action=` | `{ entries: AuditEntry[], total }` |
| POST | `/api/admin/migrate` | 全プラン一括マイグレーション | - | `MigrationResult` |
| GET | `/api/admin/schema-version` | スキーマバージョン取得 | - | `{ version: number }` |

### ヘルスチェック

| メソッド | パス | 説明 | レスポンス |
|---|---|---|---|
| GET | `/api/health` | ヘルスチェック | `{ status: 'ok', timestamp }` |

---

## 設定項目

### 環境変数

| 環境変数 | デフォルト値 | 説明 |
|---|---|---|
| `PORT` | `3001` | API サーバーのポート |
| `HOST` | `0.0.0.0` | API サーバーのホスト |
| `PLANS_DIR` | `~/.claude/plans` | プランファイルの格納ディレクトリ |
| `ARCHIVE_DIR` | `~/.claude/plans/archive` | アーカイブディレクトリ |
| `CORS_ORIGINS` | `http://localhost:5173` | 許可する CORS オリジン (カンマ区切り) |
| `ARCHIVE_RETENTION_DAYS` | `30` | アーカイブ保持日数 |

### 固定設定値 (`config.ts`)

| 設定 | 値 | 説明 |
|---|---|---|
| `maxFileSize` | `10485760` (10MB) | プランファイルの最大サイズ |
| `previewLength` | `200` | プレビューテキストの文字数 |

### 内部設定

| 設定 | 値 | ファイル |
|---|---|---|
| 最大バージョン数 | 50 | `historyService.ts` |
| 現在のスキーマバージョン | 1 | `migrationService.ts` |

---

## テストカバレッジ

### ユニットテスト

| テストファイル | テスト数 | 対象 |
|---|---|---|
| `planService.test.ts` | 37 | PlanService (CRUD, ステータス更新, frontmatter) |
| `validationService.test.ts` | 37 | バリデーション, 自動補正 |
| `queryParser.test.ts` | 27 | クエリパーサー (構文解析, フィルター抽出) |
| `notificationService.test.ts` | 26 | 通知生成, 既読管理 |
| `subtaskService.test.ts` | 22 | サブタスク CRUD, トグル |
| `viewService.test.ts` | 22 | ビュー CRUD, プリセット |
| `templateService.test.ts` | 20 | テンプレート管理, プラン作成 |
| `statusTransition.test.ts` | 19 | ステータス遷移ルール |
| `historyService.test.ts` | 19 | バージョン管理, diff, ロールバック |
| `migrationService.test.ts` | 17 | スキーママイグレーション |
| `bulkOperations.test.ts` | 13 | 一括操作 (ステータス, タグ, 優先度等) |
| `auditService.test.ts` | 11 | 監査ログ記録, 取得 |
| `searchService.test.ts` | 8 | 検索 (テキスト, フィルター) |
| `conflictService.test.ts` | 6 | 競合検知 |
| `nameGenerator.test.ts` | 5 | ファイル名生成 |
| **合計** | **289** | |

### E2E テスト (Playwright)

| テストファイル | テスト数 | 対象 |
|---|---|---|
| `status-filtering.spec.ts` | 13 | ステータスフィルター UI |
| `delete.spec.ts` | 4 | 削除操作 UI |
| **合計** | **17** | |

### テスト総数: 306
