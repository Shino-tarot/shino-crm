"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineHearingPasteBox } from "@/components/freeReadingRequests/LineHearingPasteBox";
import { HearingFormFields } from "@/components/freeReadingRequests/HearingFormFields";
import { createHearingRequest } from "@/lib/freeReadingRequests/actions";
import {
  EMPTY_HEARING_FORM_VALUES,
  HearingFormValues,
} from "@/types/freeReadingRequest";
import { ParsedHearing } from "@/lib/freeReadingRequests/parseHearingText";
import { getTodayDateString } from "@/lib/format";
import { useAccountId } from "@/components/accounts/AccountProvider";
import {
  REQUEST_CUSTOMER_MISMATCH_LABELS,
  requestCustomerMismatch,
} from "@/lib/freeReadingRequests/customerLink";

// 顧客管理の顧客詳細から「この顧客の無料鑑定を追加」した場合の紐付け先の顧客
export interface NewHearingTargetCustomer {
  id: string;
  customerNo: number;
  readingName: string;
  lineName: string;
  birthday: string;
}

// 無料鑑定ヒアリングの新規登録フォーム。
//   - customer なし: 新しい顧客を自動作成して紐付ける(従来どおり)
//   - customer あり: その顧客に紐付ける。顧客の名前・LINE表示名・生年月日を初期値として入れるが、
//     顧客の基本情報は変更しない(申込側に記録するだけ)
export function NewHearingForm({ customer }: { customer: NewHearingTargetCustomer | null }) {
  const accountId = useAccountId();
  const router = useRouter();
  const [values, setValues] = useState<HearingFormValues>(() => ({
    ...EMPTY_HEARING_FORM_VALUES,
    applicationDate: getTodayDateString(),
    ...(customer
      ? { name: customer.readingName, lineName: customer.lineName, birthDate: customer.birthday }
      : {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 既存の顧客に追加する場合、入力した名前・生年月日がその顧客と違うときは確認を求める
  const [confirmedMismatch, setConfirmedMismatch] = useState(false);
  const mismatch = customer
    ? requestCustomerMismatch(
        { name: values.name, birthDate: values.birthDate },
        { readingName: customer.readingName, birthday: customer.birthday },
      )
    : [];
  const blockedByMismatch = mismatch.length > 0 && !confirmedMismatch;

  function updateField<K extends keyof HearingFormValues>(
    field: K,
    value: HearingFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  // 確認画面で選んだ項目だけが渡される(選ばなかった項目は今の値のまま)
  function applyParsed(parsed: Partial<ParsedHearing>) {
    setValues((prev) => ({ ...prev, ...parsed }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);
    try {
      const result = await createHearingRequest(accountId, values, customer?.id, {
        confirmedCustomerMismatch: confirmedMismatch,
      });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      router.push(`/customers/free-reading-requests/${result.id}`);
    } catch {
      setErrors({
        _form: "登録に失敗しました。時間をおいて再度お試しください。",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={customer ? `/customers/${customer.id}` : "/customers/free-reading-requests"}
        className="text-sm text-violet-600 hover:text-violet-800"
      >
        {customer ? "← 顧客詳細に戻る" : "← 無料鑑定申込一覧に戻る"}
      </Link>

      <h1 className="mt-3 mb-2 text-xl font-semibold text-zinc-900">
        無料鑑定ヒアリングを登録
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        {customer
          ? `顧客「No.${customer.customerNo} ${customer.readingName || "（名前未入力）"}」の申込として登録します（顧客の基本情報は変更しません）。`
          : "新しい顧客として登録します。既に顧客管理にいるお客様の場合は、顧客詳細の「この顧客の無料鑑定を追加」から登録してください。"}
      </p>

      <LineHearingPasteBox currentValues={values} onApply={applyParsed} />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <HearingFormFields values={values} onChange={updateField} errors={errors} />

        {customer && mismatch.length > 0 && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p>
              入力した{mismatch.map((m) => REQUEST_CUSTOMER_MISMATCH_LABELS[m]).join("・")}が、追加先の顧客「No.
              {customer.customerNo} {customer.readingName || "（名前未入力）"}」と違います。
              別の人の申込の場合は、ここではなく「無料鑑定申込」の新規登録から登録してください（新しい顧客として登録されます）。
            </p>
            <label className="mt-2 flex items-start gap-2">
              <input
                type="checkbox"
                checked={confirmedMismatch}
                onChange={(e) => setConfirmedMismatch(e.target.checked)}
                className="mt-0.5"
              />
              <span>同じ人物であることを確認しました（表記の違いなど）。この顧客の申込として登録します。</span>
            </label>
          </div>
        )}

        {errors._form && <p className="text-sm text-red-500">{errors._form}</p>}

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <Link
            href={customer ? `/customers/${customer.id}` : "/customers/free-reading-requests"}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || blockedByMismatch}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isSubmitting ? "登録中..." : "登録する"}
          </button>
        </div>
      </form>
    </div>
  );
}
