import Link from "next/link";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";
import { formatDate } from "@/lib/format";

const CONTENT_PREVIEW_LENGTH = 40;

function previewContent(content: string): string {
  if (content.length <= CONTENT_PREVIEW_LENGTH) return content;
  return `${content.slice(0, CONTENT_PREVIEW_LENGTH)}…`;
}

interface FreeReadingRequestCardListProps {
  results: FreeReadingRequestListItem[];
  emptyMessage?: string;
}

// スマホで一覧から素早く目的の申込を開けるよう、テーブルの横スクロールを
// 避けたカード型レイアウト。
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
      {results.map((request) => {
        const statusInfo = STATUS_LABELS[request.status] ?? {
          label: request.status,
          className: "bg-zinc-100 text-zinc-500",
        };

        return (
          <li key={request.id}>
            <Link
              href={`/customers/free-reading-requests/${request.id}`}
              className="block rounded-md border border-zinc-200 bg-white p-4 active:bg-zinc-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-zinc-900">
                    {request.lineName || request.name || "（未登録）"}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-zinc-500">
                    相談者名: {request.name || "（未入力）"}
                  </p>
                </div>
                <span
                  className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                >
                  {statusInfo.label}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                <span className="text-xs">
                  {request.applicationDate
                    ? formatDate(request.applicationDate)
                    : "-"}
                </span>
              </div>

              {request.content && (
                <p className="mt-1 truncate text-xs text-zinc-400">
                  「{previewContent(request.content)}」
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
