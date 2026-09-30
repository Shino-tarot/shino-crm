"use client";

import { useState } from "react";
import { HearingFormValues } from "@/types/freeReadingRequest";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";
import { formatDate, formatDateTime, fromJstDateTimeLocal } from "@/lib/format";
import { CopyButton } from "@/components/ui/CopyButton";

interface CurrentFreeReadingCardProps {
  values: HearingFormValues;
  sequenceNumber: number;
  onEdit: () => void;
}

// 「今回開いている申込」を、過去履歴と同じ無料鑑定履歴セクションの中で
// 1件のカードとして見せるための表示専用コンポーネント。
// 表示内容はすべて呼び出し元が保持するHearingFormValues(state)をそのまま使うため、
// 編集フォームでの入力がリアルタイムにこのカードへ反映される(プレビューになる)。
// 保存ロジック自体はHearingDetailClient側のupdateHearingRequest呼び出しのまま変更しない。
export function CurrentFreeReadingCard({
  values,
  sequenceNumber,
  onEdit,
}: CurrentFreeReadingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusInfo = STATUS_LABELS[values.status] ?? {
    label: values.status,
    className: "bg-zinc-100 text-zinc-500",
  };

  const sentAtIso = values.sentAt ? fromJstDateTimeLocal(values.sentAt) : null;

  return (
    <li className="rounded-md border border-violet-300 bg-violet-50/50 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-block rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-semibold text-white">
          今回
        </span>
        <span className="text-sm font-semibold text-zinc-900">
          無料鑑定 #{sequenceNumber}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-zinc-600">
          {values.applicationDate ? formatDate(values.applicationDate) : "-"}
        </span>
        <span
          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
        >
          {statusInfo.label}
        </span>
      </div>

      {!isExpanded && values.content && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-zinc-600">
          {values.content}
        </p>
      )}

      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        {isExpanded ? "閉じる" : "全文を見る"}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 border-t border-violet-100 pt-3 text-sm">
          <div>
            <p className="text-zinc-500">相談内容</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-900">
              {values.content || "（未入力）"}
            </p>
          </div>

          <div>
            <p className="text-zinc-500">理想の未来</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-900">
              {values.idealFuture || "（未入力）"}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-zinc-500">送付した無料鑑定文</p>
              {values.sentReadingContent && (
                <CopyButton text={values.sentReadingContent} />
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-900">
              {values.sentReadingContent || "（未送付）"}
            </p>
            {sentAtIso && (
              <p className="mt-1 text-xs text-zinc-400">
                送付日時: {formatDateTime(sentAtIso)}
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onEdit}
        className="mt-3 w-full rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
      >
        編集する
      </button>
    </li>
  );
}
