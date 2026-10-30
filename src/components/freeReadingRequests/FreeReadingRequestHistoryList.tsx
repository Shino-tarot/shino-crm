"use client";

import { useState } from "react";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { FreeReadingHistoryCard } from "@/components/freeReadingRequests/FreeReadingHistoryCard";

const COLLAPSED_COUNT = 5;

interface FreeReadingRequestHistoryListProps {
  history: FreeReadingRequestListItem[];
  currentRequestId: string;
  currentCustomerId: string | null;
  currentCustomerHidden: boolean;
}

// 見出し(「無料鑑定履歴」)は呼び出し元(HearingDetailClient)が「今回」の
// カードとまとめて1つのセクションとして持つため、ここでは一覧本体のみを描画する。
export function FreeReadingRequestHistoryList({
  history,
  currentRequestId,
  currentCustomerId,
  currentCustomerHidden,
}: FreeReadingRequestHistoryListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMore = history.length > COLLAPSED_COUNT;
  const visibleHistory =
    isExpanded || !hasMore ? history : history.slice(0, COLLAPSED_COUNT);

  if (history.length === 0) {
    return (
      <p className="mt-3 text-sm text-zinc-500">
        同じLINE表示名の他の申込はありません。
      </p>
    );
  }

  return (
    <>
      <h3 className="mt-5 text-sm font-semibold text-zinc-900">
        同じLINE表示名の申込（{history.length}件）
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        LINE表示名が同じだけでは、同じ人物とは限りません。別人の場合は紐付けないでください。
        まとめると、候補の顧客は非表示になり、今開いている申込の顧客が残ります。
      </p>
      <ul className="mt-3 space-y-3">
        {visibleHistory.map((item, index) => (
          <FreeReadingHistoryCard
            key={item.id}
            item={item}
            currentRequestId={currentRequestId}
            currentCustomerId={currentCustomerId}
            currentCustomerHidden={currentCustomerHidden}
            sequenceNumber={index + 1}
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
