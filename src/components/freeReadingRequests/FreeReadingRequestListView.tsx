"use client";

import { useMemo, useState } from "react";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { searchFreeReadingRequests } from "@/lib/freeReadingRequests/search";
import { FreeReadingRequestTable } from "@/components/freeReadingRequests/FreeReadingRequestTable";
import { FreeReadingRequestCardList } from "@/components/freeReadingRequests/FreeReadingRequestCardList";

interface FreeReadingRequestListViewProps {
  requests: FreeReadingRequestListItem[];
}

// 一覧の検索state管理と、モバイル(カード)/PC(テーブル)の出し分けをまとめて担う。
// requestsは呼び出し元(サーバー側)で既にソート済みのため、
// ここでは絞り込みのみ行い並び順は変更しない(searchFreeReadingRequests参照)。
export function FreeReadingRequestListView({
  requests,
}: FreeReadingRequestListViewProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchFreeReadingRequests(requests, query),
    [requests, query],
  );

  const isSearching = query.trim() !== "";

  return (
    <div>
      <div className="mb-4">
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="鑑定コード・LINE表示名・相談者名で検索"
          className="w-full rounded-md border border-zinc-300 px-4 py-3 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm"
        />
        {isSearching && (
          <p className="mt-2 text-sm text-zinc-500">{results.length}件ヒット</p>
        )}
      </div>

      <div className="sm:hidden">
        <FreeReadingRequestCardList
          results={results}
          emptyMessage={
            isSearching
              ? "該当する申込が見つかりませんでした。"
              : "無料鑑定の申込はまだありません。"
          }
        />
      </div>
      <div className="hidden sm:block">
        <FreeReadingRequestTable
          results={results}
          emptyMessage={
            isSearching
              ? "該当する申込が見つかりませんでした。"
              : "無料鑑定の申込はまだありません。"
          }
        />
      </div>
    </div>
  );
}
