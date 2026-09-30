"use client";

import { useState } from "react";
import { UpsellPurchase } from "@/types/upsellPurchase";
import { formatCurrency, formatDate } from "@/lib/format";

interface UpsellPurchaseCardProps {
  purchase: UpsellPurchase;
  onEdit: () => void;
  onDelete: () => void;
}

export function UpsellPurchaseCard({
  purchase,
  onEdit,
  onDelete,
}: UpsellPurchaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li className="rounded-md border border-zinc-200 p-4">
      <p className="text-sm text-zinc-500">{formatDate(purchase.purchaseDate)}</p>
      <p className="mt-0.5 truncate text-base font-semibold text-zinc-900">
        {purchase.productName || "（商品名未入力）"}
      </p>
      <p className="mt-0.5 text-sm font-medium text-violet-700">
        {formatCurrency(purchase.amount)}
      </p>

      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        {isExpanded ? "閉じる" : "全文を見る"}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4 border-t border-zinc-100 pt-3">
          {purchase.productType && (
            <div className="text-sm">
              <p className="text-zinc-500">商品種別</p>
              <p className="mt-0.5 text-zinc-900">{purchase.productType}</p>
            </div>
          )}

          {purchase.memo && (
            <div className="text-sm">
              <p className="text-zinc-500">メモ</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-900">
                {purchase.memo}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              編集
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              削除
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
