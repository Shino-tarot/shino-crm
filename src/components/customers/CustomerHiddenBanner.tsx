"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CustomerVisibilityResult } from "@/lib/customers/actions";
import { formatDateTime } from "@/lib/format";
import { Customer } from "@/types/customer";

interface CustomerHiddenBannerProps {
  customer: Customer;
  onRestore: (id: string) => Promise<CustomerVisibilityResult>;
}

// 非表示中の顧客の詳細画面上部に出す帯。確認ダイアログを経由して復元する。
// 非表示中でも記録・会話履歴などは通常どおり閲覧できる(データは削除していないため)。
export function CustomerHiddenBanner({ customer, onRestore }: CustomerHiddenBannerProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState("");

  if (!customer.deletedAt) return null;

  async function handleConfirm() {
    if (isRestoring) return;
    setIsRestoring(true);
    setError("");
    try {
      const result = await onRestore(customer.id);
      if (!result.ok) setError(result.error);
    } catch {
      setError("復元できませんでした。時間をおいて再度お試しください。");
    } finally {
      setIsRestoring(false);
      setIsConfirmOpen(false);
    }
  }

  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-amber-900">
          <p className="font-semibold">
            {customer.mergedIntoCustomerId
              ? "この顧客は別の顧客に統合済みです（非表示中・復元不可）"
              : "この顧客は非表示中です"}
          </p>
          <p className="mt-0.5 text-xs">
            非表示にした日時：{formatDateTime(customer.deletedAt)}
            ／ 申込・購入履歴・会話履歴・LINE紐づけは削除されずに残っています。
          </p>
        </div>
        {customer.mergedIntoCustomerId ? (
          <Link
            href={`/customers/${customer.mergedIntoCustomerId}`}
            className="shrink-0 rounded-md border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            統合先の顧客を開く
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError("");
              setIsConfirmOpen(true);
            }}
            disabled={isRestoring}
            className="shrink-0 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            復元する
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {isConfirmOpen && (
        <ConfirmDialog
          title="顧客の復元"
          message={<>「{customer.readingName}」を復元し、通常の顧客一覧に戻します。よろしいですか？</>}
          confirmLabel="復元する"
          confirmingLabel="復元中..."
          isConfirming={isRestoring}
          onCancel={() => {
            if (!isRestoring) setIsConfirmOpen(false);
          }}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
