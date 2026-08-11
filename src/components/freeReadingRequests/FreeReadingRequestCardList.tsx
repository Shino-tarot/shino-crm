import Link from "next/link";
import { FreeReadingRequestSearchResult } from "@/lib/freeReadingRequests/search";
import {
  DIAGNOSIS_THEME_LABELS,
  STATUS_LABELS,
} from "@/lib/freeReadingRequests/labels";
import { formatDate } from "@/lib/format";

const RESULT_TYPE_PREVIEW_LENGTH = 12;

function previewResultType(value: string): string {
  if (value.length <= RESULT_TYPE_PREVIEW_LENGTH) return value;
  return `${value.slice(0, RESULT_TYPE_PREVIEW_LENGTH)}…`;
}

interface FreeReadingRequestCardListProps {
  results: FreeReadingRequestSearchResult[];
  emptyMessage?: string;
}

// スマホで「LINEで鑑定コードが届く→コード検索→すぐ開く」を素早く行えるよう、
// テーブルの横スクロールを避けたカード型レイアウト。
export function FreeReadingRequestCardList({
  results,
  emptyMessage = "無料鑑定の申込はまだありません。",
}: FreeReadingRequestCardListProps) {
  if (results.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {results.map(({ item: request, isExactCodeMatch }) => {
        const statusInfo = STATUS_LABELS[request.status] ?? {
          label: request.status,
          className: "bg-zinc-100 text-zinc-500",
        };

        return (
          <li key={request.id}>
            <Link
              href={`/customers/free-reading-requests/${request.id}`}
              className={`block rounded-md border p-4 active:bg-zinc-50 ${
                isExactCodeMatch
                  ? "border-violet-400 bg-violet-50 ring-1 ring-violet-400"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-lg font-bold tracking-widest text-zinc-900">
                    {request.diagnosisCode ?? "未発行"}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-zinc-700">
                    {request.lineName || "（LINE表示名未登録）"}
                  </p>
                </div>
                <span
                  className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                >
                  {statusInfo.label}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                {request.diagnosisTheme && (
                  <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {DIAGNOSIS_THEME_LABELS[request.diagnosisTheme] ??
                      request.diagnosisTheme}
                  </span>
                )}
                {request.diagnosisResultType && (
                  <span className="text-xs text-zinc-500">
                    {previewResultType(request.diagnosisResultType)}
                  </span>
                )}
                <span className="text-xs">
                  {request.applicationDate
                    ? formatDate(request.applicationDate)
                    : "-"}
                </span>
              </div>

              <p className="mt-1 truncate text-xs text-zinc-400">
                相談者名: {request.name || "（未入力）"}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
