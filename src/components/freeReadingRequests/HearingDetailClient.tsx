"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineHearingImportAccordion } from "@/components/freeReadingRequests/LineHearingImportAccordion";
import { HearingFormFields } from "@/components/freeReadingRequests/HearingFormFields";
import { BasicInfoCard } from "@/components/freeReadingRequests/BasicInfoCard";
import { CurrentFreeReadingCard } from "@/components/freeReadingRequests/CurrentFreeReadingCard";
import { FreeReadingRequestHistoryList } from "@/components/freeReadingRequests/FreeReadingRequestHistoryList";
import { RegisterCustomerButton } from "@/components/freeReadingRequests/RegisterCustomerButton";
import { CustomerSummaryCard } from "@/components/customers/CustomerSummaryCard";
import { PaidReadingSection } from "@/components/paidReadings/PaidReadingSection";
import { UpsellPurchaseSection } from "@/components/upsellPurchases/UpsellPurchaseSection";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteFreeReadingRequest,
  updateHearingRequest,
} from "@/lib/freeReadingRequests/actions";
import { HearingFormValues } from "@/types/freeReadingRequest";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { ConsultationStatsResult } from "@/lib/freeReadingRequests/consultationStats";
import { ParsedHearing } from "@/lib/freeReadingRequests/parseHearingText";
import { formatDate, formatDateTime } from "@/lib/format";
import { CustomerSummary } from "@/types/customerSummary";
import { PaidReading } from "@/types/paidReading";
import { UpsellPurchase } from "@/types/upsellPurchase";

interface HearingDetailClientProps {
  id: string;
  initialValues: HearingFormValues;
  createdAt: string;
  history: FreeReadingRequestListItem[];
  consultationStats: ConsultationStatsResult;
  customerId: string | null;
  customerSummary: CustomerSummary | null;
  paidReadings: PaidReading[];
  upsellPurchases: UpsellPurchase[];
}

export function HearingDetailClient({
  id,
  initialValues,
  createdAt,
  history,
  consultationStats,
  customerId,
  customerSummary,
  paidReadings,
  upsellPurchases,
}: HearingDetailClientProps) {
  const router = useRouter();
  const [values, setValues] = useState<HearingFormValues>(initialValues);
  // キャンセル時に直前の保存済み状態へ戻すために、保存済みの値を別に保持する。
  const [savedValues, setSavedValues] = useState<HearingFormValues>(initialValues);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const editFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditMode) {
      editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isEditMode]);

  function enterEditMode() {
    setErrors({});
    setSavedMessage("");
    setIsEditMode(true);
  }

  function updateField<K extends keyof HearingFormValues>(
    field: K,
    value: HearingFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
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
    // 取り込んだ内容をすぐ確認・保存できるよう編集モードへ切り替える
    enterEditMode();
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
      setSavedValues(values);
      setSavedMessage("保存しました。");
      setIsEditMode(false);
    } catch {
      setErrors({
        _form: "更新に失敗しました。時間をおいて再度お試しください。",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancelEdit() {
    setValues(savedValues);
    setErrors({});
    setSavedMessage("");
    setIsEditMode(false);
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

  // 「今回」を含めた無料鑑定の総数。customer_id紐付け済みならDB集計値、
  // 未紐付けでもLINE表示名ベースの履歴突合(computeConsultationStats)から算出できる。
  const totalFreeReadingCount = customerSummary
    ? customerSummary.freeReadingCount
    : consultationStats.available
      ? consultationStats.stats.count
      : history.length + 1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/customers/free-reading-requests"
        className="text-sm text-violet-600 hover:text-violet-800"
      >
        ← 無料鑑定申込一覧に戻る
      </Link>

      {/* ① 顧客名・基本的な識別情報 */}
      <div className="mt-3 mb-2">
        <p className="text-xs text-zinc-400">
          登録日時: {formatDateTime(createdAt)}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">
          {values.name || "（未入力）"}
        </h1>
        <div className="mt-1 space-y-0.5 text-sm text-zinc-500">
          <p>LINE表示名：{values.lineName || "—"}</p>
          <p>
            生年月日：
            {values.birthDate ? formatDate(values.birthDate) : "—"}
          </p>
        </div>
      </div>

      {/* ② 顧客サマリー */}
      <CustomerSummaryCard
        freeReadingCount={totalFreeReadingCount}
        paidReadingCount={customerSummary ? customerSummary.paidReadingCount : null}
        upsellCount={customerSummary ? customerSummary.upsellCount : null}
        totalAmount={customerSummary ? customerSummary.totalAmount : null}
      />

      {/* ③ 顧客登録案内(未登録の場合のみ) */}
      {!customerId && <RegisterCustomerButton requestId={id} />}

      {/* ④ 基本情報(閲覧 / 編集) */}
      {!isEditMode && (
        <>
          <BasicInfoCard
            values={values}
            onEdit={enterEditMode}
            firstApplicationDate={
              consultationStats.available
                ? consultationStats.stats.firstApplicationDate
                : null
            }
          />
          {savedMessage && (
            <p className="mt-2 text-sm text-green-600">{savedMessage}</p>
          )}
        </>
      )}

      {isEditMode && (
        <div
          ref={editFormRef}
          className="mt-6 rounded-md border border-violet-200 bg-white p-4"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">編集モード</h2>
            <span className="text-xs text-zinc-400">
              保存すると各カードへ反映されます
            </span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <HearingFormFields values={values} onChange={updateField} errors={errors} />

            {errors._form && <p className="text-sm text-red-500">{errors._form}</p>}

            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {isSubmitting ? "保存中..." : "保存する"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ⑤ 無料鑑定履歴(今回 + 過去) */}
      <section className="mt-10 border-t border-zinc-200 pt-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          無料鑑定履歴（全{totalFreeReadingCount}件）
        </h2>
        <ul className="mt-3 space-y-3">
          <CurrentFreeReadingCard
            values={values}
            sequenceNumber={totalFreeReadingCount}
            onEdit={enterEditMode}
          />
        </ul>
        <FreeReadingRequestHistoryList
          history={history}
          currentRequestId={id}
          currentCustomerId={customerId}
          currentName={values.name}
          currentLineName={values.lineName}
          totalCount={totalFreeReadingCount}
        />
      </section>

      {/* ⑥⑦ 有料鑑定履歴・アップセル購入履歴
          未登録の場合は2つの空セクションを1つのコンパクトな案内にまとめる。
          customer_idがある場合は既存どおりそれぞれ独立したセクションを表示する
          (PaidReadingSection/UpsellPurchaseSectionのCRUD実装は変更していない)。 */}
      {customerId ? (
        <>
          <PaidReadingSection customerId={customerId} readings={paidReadings} />
          <UpsellPurchaseSection customerId={customerId} purchases={upsellPurchases} />
        </>
      ) : (
        <section className="mt-10 border-t border-zinc-200 pt-6">
          <h2 className="text-sm font-semibold text-zinc-900">購入履歴</h2>
          <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
            顧客登録後に、有料鑑定・アップセルの購入履歴を記録できます。
          </p>
        </section>
      )}

      {/* ⑧ LINEヒアリング取り込み */}
      <LineHearingImportAccordion onParsed={applyParsed} />

      {/* ⑨ その他管理情報 */}
      <section className="mt-10 border-t border-zinc-200 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">管理メモ</h2>
          <button
            type="button"
            onClick={enterEditMode}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            編集する
          </button>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {values.memo || "メモはありません。"}
        </p>
      </section>

      {/* ⑩ 削除(Danger Zone。誤操作を避けるため折りたたみにしている) */}
      <div className="mt-12 border-t border-zinc-200 pt-6">
        <button
          type="button"
          onClick={() => setIsDangerZoneOpen((prev) => !prev)}
          className="text-xs text-zinc-400 underline hover:text-zinc-600"
        >
          {isDangerZoneOpen ? "削除メニューを閉じる" : "削除・その他の操作"}
        </button>

        {isDangerZoneOpen && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-semibold text-red-800">顧客データの削除</h3>
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
        )}
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
