"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { CopyButton } from "@/components/ui/CopyButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { linkRequestsAsSameCustomer } from "@/lib/customers/linking";
import { getCustomerSummary } from "@/lib/customers/summary";
import { CustomerSummary } from "@/types/customerSummary";

function displayLabel(name: string, lineName: string): string {
  return lineName || name || "（名前未入力）";
}

interface FreeReadingHistoryCardProps {
  item: FreeReadingRequestListItem;
  currentRequestId: string;
  currentCustomerId: string | null;
  currentName: string;
  currentLineName: string;
  sequenceNumber: number;
}

// 過去の無料鑑定履歴1件分のカード。デフォルトは折りたたみ、
// 「全文を見る」でヒアリング内容・送付した無料鑑定文を展開表示する。
// 「同じ顧客として紐付ける」は必ず確認ダイアログを経由し、
// LINE表示名だけを根拠にした自動統合は行わない(スタッフの明示操作のみ)。
// ダイアログを開く前に、統合元(この申込)の顧客に何件の鑑定・購入履歴が
// 紐づいているかを取得して表示し、誤って別人を統合しないよう判断材料を示す。
export function FreeReadingHistoryCard({
  item,
  currentRequestId,
  currentCustomerId,
  currentName,
  currentLineName,
  sequenceNumber,
}: FreeReadingHistoryCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLinkConfirmOpen, setIsLinkConfirmOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [mergePreview, setMergePreview] = useState<CustomerSummary | null>(null);

  const statusInfo = STATUS_LABELS[item.status] ?? {
    label: item.status,
    className: "bg-zinc-100 text-zinc-500",
  };

  const alreadyLinked =
    currentCustomerId !== null && item.customerId === currentCustomerId;

  const sourceLabel = displayLabel(item.name, item.lineName);
  const targetLabel = displayLabel(currentName, currentLineName);

  async function handleOpenLinkDialog() {
    setLinkError("");
    if (item.customerId) {
      setIsLoadingPreview(true);
      try {
        const summary = await getCustomerSummary(item.customerId);
        setMergePreview(summary);
      } catch {
        setMergePreview(null);
      } finally {
        setIsLoadingPreview(false);
      }
    } else {
      setMergePreview(null);
    }
    setIsLinkConfirmOpen(true);
  }

  async function handleLinkConfirm() {
    setIsLinking(true);
    setLinkError("");
    try {
      await linkRequestsAsSameCustomer(currentRequestId, item.id);
      setIsLinkConfirmOpen(false);
      router.refresh();
    } catch {
      setLinkError("紐付けに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsLinking(false);
    }
  }

  const hasExistingHistory =
    mergePreview !== null &&
    (mergePreview.freeReadingCount > 1 ||
      mergePreview.paidReadingCount > 0 ||
      mergePreview.upsellCount > 0);

  return (
    <li className="rounded-md border border-zinc-200 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-zinc-900">
          無料鑑定 #{sequenceNumber}
        </span>
        {alreadyLinked && (
          <span className="inline-block whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            同じ顧客
          </span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-zinc-600">
          {item.applicationDate ? formatDate(item.applicationDate) : "-"}
        </span>
        <span
          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
        >
          {statusInfo.label}
        </span>
      </div>

      {!isExpanded && item.content && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-zinc-600">
          {item.content}
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
        <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 text-sm">
          <div>
            <p className="text-zinc-500">生年月日</p>
            <p className="mt-0.5 text-zinc-900">
              {item.birthDate ? formatDate(item.birthDate) : "-"}
            </p>
          </div>

          {item.partnerName && (
            <div>
              <p className="text-zinc-500">お相手</p>
              <p className="mt-0.5 text-zinc-900">
                {item.partnerName}
                {item.partnerBirthDate
                  ? `（${formatDate(item.partnerBirthDate)}）`
                  : ""}
              </p>
            </div>
          )}

          <div>
            <p className="text-zinc-500">相談内容</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-900">
              {item.content || "（未入力）"}
            </p>
          </div>

          <div>
            <p className="text-zinc-500">理想の未来</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-900">
              {item.idealFuture || "（未入力）"}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-zinc-500">送付した無料鑑定文</p>
              {item.sentReadingContent && (
                <CopyButton text={item.sentReadingContent} />
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-900">
              {item.sentReadingContent || "（未送付）"}
            </p>
            {item.sentAt && (
              <p className="mt-1 text-xs text-zinc-400">
                送付日時: {formatDateTime(item.sentAt)}
              </p>
            )}
          </div>

          {item.memo && (
            <div>
              <p className="text-zinc-500">メモ</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-900">
                {item.memo}
              </p>
            </div>
          )}

          <Link
            href={`/customers/free-reading-requests/${item.id}`}
            className="inline-block text-sm text-violet-600 hover:text-violet-800"
          >
            この申込の編集画面を開く →
          </Link>
        </div>
      )}

      {!alreadyLinked && (
        <button
          type="button"
          onClick={handleOpenLinkDialog}
          disabled={isLoadingPreview}
          className="mt-2 w-full rounded-md border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
        >
          {isLoadingPreview ? "確認中..." : "同じ顧客として紐付ける"}
        </button>
      )}
      {linkError && <p className="mt-1 text-sm text-red-600">{linkError}</p>}

      {isLinkConfirmOpen && (
        <ConfirmDialog
          title="同じ顧客として紐付け"
          message={
            <div className="space-y-2">
              <p>
                統合元:「<strong>{sourceLabel}</strong>」（この無料鑑定申込）
                <br />
                統合先:「<strong>{targetLabel}</strong>」（今開いているお客様）
              </p>
              {hasExistingHistory && mergePreview ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
                  統合元の顧客には現在、無料鑑定
                  {mergePreview.freeReadingCount}件・有料鑑定
                  {mergePreview.paidReadingCount}件・アップセル
                  {mergePreview.upsellCount}件が紐づいています。
                  <strong>
                    この顧客に紐づいている無料鑑定・有料鑑定・購入履歴もまとめて統合先へ移動します。
                  </strong>
                </p>
              ) : (
                <p>
                  統合元の申込を、統合先のお客様と同じ顧客として紐付けます。
                </p>
              )}
              <p>
                <strong>
                  別人を誤って統合していないか、必ずご確認ください。
                </strong>
                この操作は取り消せません。
              </p>
            </div>
          }
          confirmLabel="紐付ける"
          confirmingLabel="処理中..."
          isConfirming={isLinking}
          onCancel={() => setIsLinkConfirmOpen(false)}
          onConfirm={handleLinkConfirm}
        />
      )}
    </li>
  );
}
