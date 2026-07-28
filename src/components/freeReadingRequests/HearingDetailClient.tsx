"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineHearingPasteBox } from "@/components/freeReadingRequests/LineHearingPasteBox";
import { HearingFormFields } from "@/components/freeReadingRequests/HearingFormFields";
import { FreeReadingRequestHistoryList } from "@/components/freeReadingRequests/FreeReadingRequestHistoryList";
import { ConsultationStatsCard } from "@/components/freeReadingRequests/ConsultationStatsCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteFreeReadingRequest,
  updateHearingRequest,
} from "@/lib/freeReadingRequests/actions";
import { HearingFormValues } from "@/types/freeReadingRequest";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { ConsultationStatsResult } from "@/lib/freeReadingRequests/consultationStats";
import { ParsedHearing } from "@/lib/freeReadingRequests/parseHearingText";
import { formatDateTime } from "@/lib/format";

interface HearingDetailClientProps {
  id: string;
  initialValues: HearingFormValues;
  createdAt: string;
  history: FreeReadingRequestListItem[];
  consultationStats: ConsultationStatsResult;
}

export function HearingDetailClient({
  id,
  initialValues,
  createdAt,
  history,
  consultationStats,
}: HearingDetailClientProps) {
  const router = useRouter();
  const [values, setValues] = useState<HearingFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function updateField<K extends keyof HearingFormValues>(
    field: K,
    value: HearingFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setSavedMessage("");
  }

  function applyParsed(parsed: ParsedHearing) {
    setValues((prev) => ({
      ...prev,
      name: parsed.name || prev.name,
      birthDate: parsed.birthDate || prev.birthDate,
      partnerName: parsed.partnerName || prev.partnerName,
      partnerBirthDate: parsed.partnerBirthDate || prev.partnerBirthDate,
      content: parsed.content || prev.content,
      idealFuture: parsed.idealFuture || prev.idealFuture,
    }));
    setSavedMessage("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSavedMessage("");
    setIsSubmitting(true);
    try {
      const result = await updateHearingRequest(id, values);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setSavedMessage("保存しました。");
    } catch {
      setErrors({
        _form: "更新に失敗しました。時間をおいて再度お試しください。",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteFreeReadingRequest(id);
      router.push("/customers/free-reading-requests?deleted=1");
    } catch {
      setDeleteError("削除に失敗しました。時間をおいて再度お試しください。");
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/customers/free-reading-requests"
        className="text-sm text-violet-600 hover:text-violet-800"
      >
        ← 無料鑑定申込一覧に戻る
      </Link>

      <div className="mt-3 mb-6">
        <p className="text-xs text-zinc-400">
          登録日時: {formatDateTime(createdAt)}
        </p>
        <h1 className="text-xl font-semibold text-zinc-900">
          {values.name || "（未入力）"}
        </h1>
      </div>

      <ConsultationStatsCard stats={consultationStats} />

      <LineHearingPasteBox onParsed={applyParsed} />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <HearingFormFields values={values} onChange={updateField} errors={errors} />

        {errors._form && <p className="text-sm text-red-500">{errors._form}</p>}
        {savedMessage && (
          <p className="text-sm text-green-600">{savedMessage}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isSubmitting ? "保存中..." : "保存する"}
          </button>
        </div>
      </form>

      <FreeReadingRequestHistoryList history={history} />

      <div className="mt-10 rounded-md border border-red-200 bg-red-50 p-4">
        <h2 className="text-sm font-semibold text-red-800">顧客データの削除</h2>
        <p className="mt-1 text-sm text-red-700">
          この無料鑑定申込データを削除します。削除すると元に戻せません。
        </p>
        {deleteError && (
          <p className="mt-2 text-sm font-medium text-red-700">{deleteError}</p>
        )}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setIsDeleteConfirmOpen(true)}
            disabled={isDeleting}
            className="w-full rounded-md border border-red-600 bg-white px-6 py-3 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 sm:w-auto"
          >
            削除する
          </button>
        </div>
      </div>

      {isDeleteConfirmOpen && (
        <ConfirmDialog
          title="顧客データの削除"
          message={
            <>
              この顧客データを削除しますか？
              <br />
              この操作は取り消せません。
            </>
          }
          confirmLabel="削除する"
          confirmingLabel="削除中..."
          isConfirming={isDeleting}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
