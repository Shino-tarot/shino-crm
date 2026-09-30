"use client";

import { useState } from "react";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { FreeReadingHistoryCard } from "@/components/freeReadingRequests/FreeReadingHistoryCard";

const COLLAPSED_COUNT = 5;

interface FreeReadingRequestHistoryListProps {
  history: FreeReadingRequestListItem[];
  currentRequestId: string;
  currentCustomerId: string | null;
  currentName: string;
  currentLineName: string;
  // 「今回」を含めた無料鑑定の総数。過去履歴は日付降順のため、
  // 直近の履歴からtotalCount-1, totalCount-2 ... と番号を振る。
  totalCount: number;
}

// 見出し(「無料鑑定履歴」)は呼び出し元(HearingDetailClient)が「今回」の
// カードとまとめて1つのセクションとして持つため、ここでは一覧本体のみを描画する。
export function FreeReadingRequestHistoryList({
  history,
  currentRequestId,
  currentCustomerId,
  currentName,
  currentLineName,
  totalCount,
}: FreeReadingRequestHistoryListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMore = history.length > COLLAPSED_COUNT;
  const visibleHistory =
    isExpanded || !hasMore ? history : history.slice(0, COLLAPSED_COUNT);

  if (history.length === 0) {
    return (
      <p className="mt-3 text-sm text-zinc-500">
        過去の無料鑑定履歴はありません。
      </p>
    );
  }

  return (
    <>
      <ul className="mt-3 space-y-3">
        {visibleHistory.map((item, index) => (
          <FreeReadingHistoryCard
            key={item.id}
            item={item}
            currentRequestId={currentRequestId}
            currentCustomerId={currentCustomerId}
            currentName={currentName}
            currentLineName={currentLineName}
            sequenceNumber={totalCount - 1 - index}
          />
        ))}
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
  );
}
