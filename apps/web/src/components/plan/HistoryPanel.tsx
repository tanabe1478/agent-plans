import type { DiffLine, PlanVersion } from '@ccplans/shared';
import { ChevronRight, History, Loader2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useDiff, useHistory, useRollback } from '@/lib/hooks/useHistory';
import { formatDate, formatFileSize } from '@/lib/utils';

interface HistoryPanelProps {
  filename: string;
}

export function HistoryPanel({ filename }: HistoryPanelProps) {
  const { data, isLoading } = useHistory(filename);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<string | null>(null);
  const rollbackMutation = useRollback();

  const { data: diffData, isLoading: isDiffLoading } = useDiff(filename, selectedVersion);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const versions = data?.versions ?? [];

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <History className="h-8 w-8 mb-2" />
        <p>履歴がありません</p>
      </div>
    );
  }

  function handleRollback(version: string) {
    rollbackMutation.mutate(
      { filename, version },
      {
        onSuccess: () => {
          setShowRollbackConfirm(null);
          setSelectedVersion(null);
        },
      }
    );
  }

  return (
    <div className="space-y-4">
      {/* Version list */}
      <div className="space-y-2">
        {versions.map((v: PlanVersion) => (
          <VersionItem
            key={v.version}
            version={v}
            isSelected={selectedVersion === v.version}
            onSelect={() => setSelectedVersion(selectedVersion === v.version ? null : v.version)}
            onRollback={() => setShowRollbackConfirm(v.version)}
          />
        ))}
      </div>

      {/* Rollback confirmation dialog */}
      {showRollbackConfirm && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-950/30">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
            このバージョンにロールバックしますか?
          </p>
          <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
            現在の内容は履歴に保存されます。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handleRollback(showRollbackConfirm)}
              disabled={rollbackMutation.isPending}
              className="rounded bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {rollbackMutation.isPending ? 'ロールバック中...' : 'ロールバック'}
            </button>
            <button
              onClick={() => setShowRollbackConfirm(null)}
              className="rounded border px-3 py-1 text-sm hover:bg-muted"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Diff view */}
      {selectedVersion && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">差分（選択バージョン → 現在）</h3>
          {isDiffLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : diffData ? (
            <DiffView lines={diffData.lines} stats={diffData.stats} />
          ) : null}
        </div>
      )}
    </div>
  );
}

interface VersionItemProps {
  version: PlanVersion;
  isSelected: boolean;
  onSelect: () => void;
  onRollback: () => void;
}

function VersionItem({ version, isSelected, onSelect, onRollback }: VersionItemProps) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <button onClick={onSelect} className="flex flex-1 items-center gap-2 text-left">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${isSelected ? 'rotate-90' : ''}`}
          />
          <div>
            <p className="text-sm font-medium">{version.summary}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(version.createdAt)} · {formatFileSize(version.size)}
            </p>
          </div>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRollback();
          }}
          className="ml-2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="このバージョンにロールバック"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface DiffViewProps {
  lines: DiffLine[];
  stats: { added: number; removed: number; unchanged: number };
}

function DiffView({ lines, stats }: DiffViewProps) {
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
        <span className="text-green-600 dark:text-green-400">+{stats.added} 追加</span>
        <span className="text-red-600 dark:text-red-400">-{stats.removed} 削除</span>
        <span>{stats.unchanged} 変更なし</span>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full font-mono text-sm">
          <tbody>
            {lines.map((line, i) => (
              <tr
                key={i}
                className={
                  line.type === 'added'
                    ? 'bg-[#dcfce7] dark:bg-[#166534]/40'
                    : line.type === 'removed'
                      ? 'bg-[#fecaca] dark:bg-[#991b1b]/40'
                      : ''
                }
              >
                <td className="w-10 select-none border-r px-2 py-0.5 text-right text-xs text-muted-foreground">
                  {line.lineNumber}
                </td>
                <td className="w-6 select-none px-1 py-0.5 text-center text-xs">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </td>
                <td className="px-2 py-0.5 whitespace-pre-wrap break-all">{line.content}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
