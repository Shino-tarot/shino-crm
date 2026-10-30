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
import { FollowUpCard } from "@/components/freeReadingRequests/FollowUpCard";
import { CustomerSummaryCard } from "@/components/customers/CustomerSummaryCard";
import { PaidReadingSection } from "@/components/paidReadings/PaidReadingSection";
import { UpsellPurchaseSection } from "@/components/upsellPurchases/UpsellPurchaseSection";
import { ConversationSection } from "@/components/conversationMessages/ConversationSection";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CustomerHiddenBadge } from "@/components/freeReadingRequests/CustomerHiddenBadge";
import {
  REQUEST_CUSTOMER_MISMATCH_LABELS,
  requestCustomerMismatch,
} from "@/lib/freeReadingRequests/customerLink";
import {
  deleteFreeReadingRequest,
  updateHearingRequest,
} from "@/lib/freeReadingRequests/actions";
import { HearingFormValues } from "@/types/freeReadingRequest";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { ParsedHearing } from "@/lib/freeReadingRequests/parseHearingText";
import { DetailRequestValue } from "@/lib/freeReadingRequests/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { CustomerSummary } from "@/types/customerSummary";
import { PaidReading } from "@/types/paidReading";
import { UpsellPurchase } from "@/types/upsellPurchase";
import { ConversationMessage } from "@/types/conversationMessage";
import { useAccountId } from "@/components/accounts/AccountProvider";

interface HearingDetailClientProps {
  id: string;
  initialValues: HearingFormValues;
  createdAt: string;
  history: FreeReadingRequestListItem[];
  customerId: string | null;
  // 紐づく顧客が顧客管理で非表示(論理削除)中か
  customerHidden: boolean;
  // この申込が登録されている顧客の顧客番号・名前・生年月日(顧客未登録はnull)
  linkedCustomer: { customerNo: number; name: string | null; birthday: string | null } | null;
  customerSummary: CustomerSummary | null;
  paidReadings: PaidReading[];
  upsellPurchases: UpsellPurchase[];
  conversationMessages: ConversationMessage[];
  initialDetailRequest: DetailRequestValue;
  initialFollowedUpAt: string | null;
  sendScheduled: boolean;
}

export function HearingDetailClient({
  id,
  initialValues,
  createdAt,
  history,
  customerId,
  customerHidden,
  linkedCustomer,
  customerSummary,
  paidReadings,
  upsellPurchases,
  conversationMessages,
  initialDetailRequest,
  initialFollowedUpAt,
  sendScheduled,
}: HearingDetailClientProps) {
  const accountId = useAccountId();
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

  // 10分ごとの再取得などでサーバー側のステータスが自動更新された場合、
  // 編集中でなければ表示中のステータスも追従させる(古い値のまま保存して戻してしまわないため)。
  const [lastServerStatus, setLastServerStatus] = useState(initialValues.status);
  if (initialValues.status !== lastServerStatus && !isEditMode) {
    setLastServerStatus(initialValues.status);
    setValues((prev) => ({ ...prev, status: initialValues.status }));
    setSavedValues((prev) => ({ ...prev, status: initialValues.status }));
  }

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

  // 確認画面で選んだ項目だけが渡される(選ばなかった項目は今の値のまま)
  function applyParsed(parsed: Partial<ParsedHearing>) {
    setValues((prev) => ({ ...prev, ...parsed }));
    // 取り込んだ内容をすぐ確認・保存できるよう編集モードへ切り替える
    enterEditMode();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSavedMessage("");
    setIsSubmitting(true);
    try {
      const result = await updateHearingRequest(accountId, id, values);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setSavedValues(values);
      // 編集中に自動更新で届いたステータスは、手動で保存した値で上書き済みとして扱う
      // (保存直後に古い自動更新の値へ表示が戻り、DBと食い違うのを防ぐ)
      setLastServerStatus(initialValues.status);
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
      await deleteFreeReadingRequest(accountId, id);
      router.push("/customers/free-reading-requests?deleted=1");
    } catch {
      setDeleteError("削除に失敗しました。時間をおいて再度お試しください。");
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  }

  // 「今回」を含めたこの顧客の無料鑑定の総数(顧客IDで集計)。
  // LINE表示名が同じだけの申込は別人の可能性があるため数えない(顧客未登録ならこの申込1件のみ)。
  const totalFreeReadingCount = customerSummary ? customerSummary.freeReadingCount : 1;
  // 初回申込日も、同じ顧客IDの申込だけから求める(LINE表示名が同じだけの申込は含めない)
  const sameCustomerDates = [
    ...history
      .filter((item) => customerId !== null && item.customerId === customerId)
      .map((item) => item.applicationDate ?? item.createdAt),
    initialValues.applicationDate || createdAt,
  ].filter((date): date is string => Boolean(date));
  const firstApplicationDate =
    sameCustomerDates.length > 1
      ? sameCustomerDates.reduce((earliest, date) =>
          new Date(date).getTime() < new Date(earliest).getTime() ? date : earliest,
        )
      : null;

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

      {/* この申込が登録されている顧客(顧客番号)。申込の名前・生年月日と違う場合は注意を出す */}
      {customerId && linkedCustomer && (
        <LinkedCustomerNotice
          customerId={customerId}
          customer={linkedCustomer}
          requestName={initialValues.name}
          requestBirthDate={initialValues.birthDate}
        />
      )}

      {/* 顧客が非表示中の場合の案内(申込・購入履歴・会話履歴は通常どおり残っている) */}
      {customerId && customerHidden && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            <CustomerHiddenBadge />
            <span className="ml-2">この申込の顧客は、顧客管理で非表示になっています。</span>
          </span>
          <Link
            href={`/customers/${customerId}`}
            className="shrink-0 text-sm font-medium text-violet-700 hover:text-violet-900"
          >
            顧客詳細で復元する →
          </Link>
        </div>
      )}

      {/* ③ 顧客登録案内(未登録の場合のみ) */}
      {!customerId && <RegisterCustomerButton requestId={id} />}

      {/* ④ 基本情報(閲覧 / 編集) */}
      {!isEditMode && (
        <>
          <BasicInfoCard
            values={values}
            sendScheduled={sendScheduled}
            onEdit={enterEditMode}
            firstApplicationDate={firstApplicationDate}
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

      {/* 詳細希望・フォロー状況(編集モードとは独立して即保存) */}
      <FollowUpCard
        requestId={id}
        initialDetailRequest={initialDetailRequest}
        initialFollowedUpAt={initialFollowedUpAt}
      />

      {/* ⑤ 無料鑑定履歴(今回 + 過去) */}
      <section className="mt-10 border-t border-zinc-200 pt-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          この顧客の無料鑑定（全{totalFreeReadingCount}件）
        </h2>
        <ul className="mt-3 space-y-3">
          <CurrentFreeReadingCard
            values={values}
            sendScheduled={sendScheduled}
            sequenceNumber={totalFreeReadingCount}
            onEdit={enterEditMode}
          />
        </ul>
        <FreeReadingRequestHistoryList
          history={history}
          currentRequestId={id}
          currentCustomerId={customerId}
          currentCustomerHidden={customerHidden}
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
          {/* 会話履歴(顧客単位。無料鑑定〜本鑑定〜購入後フォローまで時系列で表示) */}
          <ConversationSection customerId={customerId} messages={conversationMessages} />
        </>
      ) : (
        <section className="mt-10 border-t border-zinc-200 pt-6">
          <h2 className="text-sm font-semibold text-zinc-900">購入履歴・会話履歴</h2>
          <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
            顧客登録後に、有料鑑定・アップセルの購入履歴と会話履歴を記録できます。
          </p>
        </section>
      )}

      {/* ⑧ LINEヒアリング取り込み */}
      <LineHearingImportAccordion
        currentValues={values}
        onApply={applyParsed}
        lineMessages={conversationMessages
          .filter((message) => message.direction === "incoming")
          .map((message) => ({ id: message.id, body: message.body, sentAt: message.sentAt }))}
      />

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

function LinkedCustomerNotice({
  customerId,
  customer,
  requestName,
  requestBirthDate,
}: {
  customerId: string;
  customer: { customerNo: number; name: string | null; birthday: string | null };
  requestName: string;
  requestBirthDate: string;
}) {
  const mismatch = requestCustomerMismatch(
    { name: requestName, birthDate: requestBirthDate },
    { readingName: customer.name, birthday: customer.birthday },
  );
  return (
    <div
      className={`mt-4 rounded-md border px-4 py-2 text-sm ${
        mismatch.length > 0 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-zinc-200 bg-white text-zinc-600"
      }`}
    >
      この申込の顧客：
      <Link href={`/customers/${customerId}`} className="font-medium text-violet-700 hover:text-violet-900">
        顧客番号 No.{customer.customerNo} {customer.name || "（名前未入力）"}
      </Link>
      {customer.birthday ? `（${formatDate(customer.birthday)}）` : ""}
      {mismatch.length > 0 && (
        <p className="mt-1 text-xs">
          申込の{mismatch.map((m) => REQUEST_CUSTOMER_MISMATCH_LABELS[m]).join("・")}
          が顧客の情報と違います。別の人の申込がこの顧客に登録されている可能性があるため、統合する前に確認してください。
        </p>
      )}
    </div>
  );
}
