"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateDetailRequest,
  updateFollowedUp,
} from "@/lib/freeReadingRequests/actions";
import {
  DETAIL_REQUEST_OPTIONS,
  DetailRequestValue,
} from "@/lib/freeReadingRequests/labels";
import { formatDateTime } from "@/lib/format";
import { useAccountId } from "@/components/accounts/AccountProvider";

interface FollowUpCardProps {
  requestId: string;
  initialDetailRequest: DetailRequestValue;
  initialFollowedUpAt: string | null;
}

// 詳細希望・フォロー状況は、基本情報の編集モードとは独立して変更のたびに即保存する
// (それぞれdetail_request / followed_up_atだけを更新し、ステータス等には触れない)。
export function FollowUpCard({
  requestId,
  initialDetailRequest,
  initialFollowedUpAt,
}: FollowUpCardProps) {
  const accountId = useAccountId();
  const router = useRouter();
  const [detailRequest, setDetailRequest] =
    useState<DetailRequestValue>(initialDetailRequest);
  const [followedUpAt, setFollowedUpAt] = useState(initialFollowedUpAt);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleDetailRequestChange(value: DetailRequestValue) {
    if (value === detailRequest) return;
    setIsSaving(true);
    setError("");
    try {
      const result = await updateDetailRequest(accountId, requestId, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDetailRequest(value);
      // 画面上部のフォロー通知をすぐ更新する(入力中のフォーム等の状態は保持される)
      router.refresh();
    } catch {
      setError("詳細希望の保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFollowedUpToggle() {
    setIsSaving(true);
    setError("");
    try {
      const result = await updateFollowedUp(accountId, requestId, !followedUpAt);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFollowedUpAt(result.followedUpAt);
      router.refresh();
    } catch {
      setError("フォロー状況の保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">フォロー管理</h2>

      <dl className="mt-3 divide-y divide-zinc-100">
        <div className="py-2 first:pt-0">
          <dt className="text-xs text-zinc-500">詳細希望</dt>
          <dd className="mt-1.5 flex flex-wrap gap-2">
            {DETAIL_REQUEST_OPTIONS.map((option) => {
              const isSelected = option.value === detailRequest;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleDetailRequestChange(option.value)}
                  disabled={isSaving}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                    isSelected
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </dd>
        </div>

        <div className="py-2 last:pb-0">
          <dt className="text-xs text-zinc-500">フォロー状況</dt>
          <dd className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-zinc-900">
              {followedUpAt
                ? `フォロー済み（${formatDateTime(followedUpAt)}）`
                : "未フォロー"}
            </span>
            <button
              type="button"
              onClick={handleFollowedUpToggle}
              disabled={isSaving}
              className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {followedUpAt ? "未フォローに戻す" : "フォロー済みにする"}
            </button>
          </dd>
        </div>
      </dl>

      {isSaving && <p className="mt-2 text-xs text-zinc-400">保存中...</p>}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
