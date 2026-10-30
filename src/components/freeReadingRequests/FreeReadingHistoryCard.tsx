"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { CopyButton } from "@/components/ui/CopyButton";
import { CustomerHiddenBadge } from "@/components/freeReadingRequests/CustomerHiddenBadge";
import { getMergePreview, linkRequestsAsSameCustomer } from "@/lib/customers/linking";
import { MergeConfirmation } from "@/lib/customers/mergeRules";
import { MergePreview } from "@/types/customerMerge";
import { MergeConfirmModal } from "@/components/freeReadingRequests/MergeConfirmModal";
import { useAccountId } from "@/components/accounts/AccountProvider";
import {
  REQUEST_CUSTOMER_MISMATCH_LABELS,
  requestCustomerMismatch,
} from "@/lib/freeReadingRequests/customerLink";

interface FreeReadingHistoryCardProps {
  item: FreeReadingRequestListItem;
  currentRequestId: string;
  currentCustomerId: string | null;
  // 表示中の申込(統合先)の顧客が非表示中か
  currentCustomerHidden: boolean;
  sequenceNumber: number;
}

// 同じLINE表示名の申込1件分のカード(同じ人物とは限らない)。デフォルトは折りたたみ、
// 「全文を見る」でヒアリング内容・送付した無料鑑定文を展開表示する。
// 「同じ顧客として紐付ける」は必ず確認画面(MergeConfirmModal)を経由し、
// LINE表示名だけを根拠にした自動統合は行わない(スタッフの明示操作のみ)。
// 確認画面では2人の顧客番号・名前・生年月日・LINE連携・申込履歴を並べて比べられるようにする。
export function FreeReadingHistoryCard({
  item,
  currentRequestId,
  currentCustomerId,
  currentCustomerHidden,
  sequenceNumber,
}: FreeReadingHistoryCardProps) {
  const accountId = useAccountId();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLinkConfirmOpen, setIsLinkConfirmOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);

  const statusInfo = STATUS_LABELS[item.status] ?? {
    label: item.status,
    className: "bg-zinc-100 text-zinc-500",
  };

  const alreadyLinked =
    currentCustomerId !== null && item.customerId === currentCustomerId;

  // この申込に書かれた名前・生年月日と、登録先の顧客が違う(別の顧客に誤って登録された申込の可能性)
  const mismatch =
    item.customerNo === null
      ? []
      : requestCustomerMismatch(
          { name: item.name, birthDate: item.birthDate },
          { readingName: item.customerName, birthday: item.customerBirthday },
        );

  // 非表示中の顧客が関わる統合はしない(サーバー側でも拒否する)
  const mergeBlockedByHidden = currentCustomerHidden || item.customerHidden;

  async function handleOpenLinkDialog() {
    setLinkError("");
    setIsLoadingPreview(true);
    try {
      const result = await getMergePreview(accountId, currentRequestId, item.id);
      if (!result.ok) {
        setLinkError(result.error);
        return;
      }
      if (result.preview.kind === "already_same") {
        router.refresh();
        return;
      }
      setMergePreview(result.preview);
      setIsLinkConfirmOpen(true);
    } catch {
      setLinkError("確認情報の取得に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsLoadingPreview(false);
    }
  }

  async function handleLinkConfirm(confirmation: MergeConfirmation) {
    // 処理中の二重実行を防ぐ(確認ボタンも処理中は無効化している)
    if (isLinking) return;
    setIsLinking(true);
    setLinkError("");
    try {
      const result = await linkRequestsAsSameCustomer(accountId, currentRequestId, item.id, confirmation);
      setIsLinkConfirmOpen(false);
      if (result.ok) {
        router.refresh();
      } else {
        setLinkError(result.error);
      }
    } catch {
      setIsLinkConfirmOpen(false);
      setLinkError("紐付けに失敗しました。データは変更されていません。時間をおいて再度お試しください。");
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <li className="rounded-md border border-zinc-200 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-zinc-900">
          同じLINE表示名の申込 {sequenceNumber}
        </span>
        {alreadyLinked && (
          <span className="inline-block whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            同じ顧客
          </span>
        )}
        {!alreadyLinked && (
          <span className="inline-block whitespace-nowrap rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
            表示名のみ一致
          </span>
        )}
        {item.customerHidden && <CustomerHiddenBadge />}
        <span className="inline-block whitespace-nowrap rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600">
          {item.customerNo === null ? "顧客未登録" : `顧客 No.${item.customerNo}`}
        </span>
      </div>

      <p className="mt-1 text-sm text-zinc-900">
        {item.name || "（名前未入力）"}
        <span className="ml-2 text-xs text-zinc-500">
          生年月日：{item.birthDate ? formatDate(item.birthDate) : "—"}
        </span>
      </p>
      {mismatch.length > 0 && (
        <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
          この申込は顧客「No.{item.customerNo} {item.customerName || "（名前未入力）"}」
          {item.customerBirthday ? `（${formatDate(item.customerBirthday)}）` : ""}
          に登録されています。申込の{mismatch.map((m) => REQUEST_CUSTOMER_MISMATCH_LABELS[m]).join("・")}
          が顧客の情報と違うため、別の人の申込が登録されている可能性があります。
        </p>
      )}

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
          disabled={isLoadingPreview || mergeBlockedByHidden}
          className="mt-2 w-full rounded-md border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
        >
          {isLoadingPreview ? "確認中..." : "この候補を、今開いている顧客にまとめる"}
        </button>
      )}
      {!alreadyLinked && mergeBlockedByHidden && (
        <p className="mt-1 text-xs text-amber-800">
          非表示中の顧客が含まれるため紐付けできません。顧客管理で復元してから操作してください。
        </p>
      )}
      {linkError && <p className="mt-1 text-sm text-red-600">{linkError}</p>}

      {isLinkConfirmOpen && mergePreview && mergePreview.kind !== "already_same" && (
        <MergeConfirmModal
          preview={mergePreview}
          isSubmitting={isLinking}
          onCancel={() => setIsLinkConfirmOpen(false)}
          onConfirm={handleLinkConfirm}
        />
      )}
    </li>
  );
}
