"use client";

import { useState } from "react";
import Link from "next/link";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";
import { formatDate } from "@/lib/format";

const CONTENT_PREVIEW_LENGTH = 40;
const COLLAPSED_COUNT = 5;

function previewContent(content: string): string {
  if (content.length <= CONTENT_PREVIEW_LENGTH) return content;
  return `${content.slice(0, CONTENT_PREVIEW_LENGTH)}…`;
}

interface FreeReadingRequestHistoryListProps {
  history: FreeReadingRequestListItem[];
}

export function FreeReadingRequestHistoryList({
  history,
}: FreeReadingRequestHistoryListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMore = history.length > COLLAPSED_COUNT;
  const visibleHistory =
    isExpanded || !hasMore ? history : history.slice(0, COLLAPSED_COUNT);

  return (
    <div className="mt-10 border-t border-zinc-200 pt-6">
      <h2 className="text-sm font-semibold text-zinc-900">
        過去の無料鑑定履歴（{history.length}件）
      </h2>

      {history.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          過去の無料鑑定履歴はありません。
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {visibleHistory.map((item) => {
              const statusInfo = STATUS_LABELS[item.status] ?? {
                label: item.status,
                className: "bg-zinc-100 text-zinc-500",
              };
              return (
                <li
                  key={item.id}
                  className="rounded-md border border-zinc-200 p-3"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="whitespace-nowrap text-zinc-600">
                      {item.applicationDate
                        ? formatDate(item.applicationDate)
                        : "-"}
                    </span>
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex flex-wrap gap-x-1">
                      <dt className="shrink-0 text-zinc-500">LINE表示名:</dt>
                      <dd className="min-w-0 break-words font-medium text-zinc-900">
                        {item.lineName || "-"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-x-1">
                      <dt className="shrink-0 text-zinc-500">相談者名:</dt>
                      <dd className="min-w-0 break-words font-medium text-zinc-900">
                        {item.name || "（未入力）"}
                      </dd>
                    </div>
                  </dl>
                  {item.content && (
                    <p className="mt-2 break-words text-sm text-zinc-600">
                      「{previewContent(item.content)}」
                    </p>
                  )}
                  <Link
                    href={`/customers/free-reading-requests/${item.id}`}
                    className="mt-2 inline-block text-sm text-violet-600 hover:text-violet-800"
                  >
                    詳細を見る →
                  </Link>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto"
            >
              {isExpanded ? "閉じる" : `もっと見る（残り${history.length - COLLAPSED_COUNT}件）`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
