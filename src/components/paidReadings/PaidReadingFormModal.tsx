"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  EMPTY_PAID_READING_FORM_VALUES,
  PaidReading,
  PaidReadingFormValues,
} from "@/types/paidReading";
import { getTodayDateString, toDateTimeLocalInput } from "@/lib/format";

interface PaidReadingFormModalProps {
  target: PaidReading | null;
  onClose: () => void;
  onSubmit: (
    values: PaidReadingFormValues,
  ) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
}

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm";

export function PaidReadingFormModal({
  target,
  onClose,
  onSubmit,
}: PaidReadingFormModalProps) {
  const [values, setValues] = useState<PaidReadingFormValues>(
    target
      ? {
          purchaseDate: target.purchaseDate,
          productName: target.productName,
          amount: target.amount,
          paymentMethod: target.paymentMethod,
          hearingContent: target.hearingContent,
          readingContent: target.readingContent,
          sentAt: toDateTimeLocalInput(target.sentAt || null),
          memo: target.memo,
        }
      : { ...EMPTY_PAID_READING_FORM_VALUES, purchaseDate: getTodayDateString() },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof PaidReadingFormValues>(
    field: K,
    value: PaidReadingFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);
    try {
      const result = await onSubmit(values);
      if (!result.ok) {
        setErrors(result.errors ?? {});
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={target ? "有料鑑定を編集" : "有料鑑定を追加"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            購入日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={values.purchaseDate}
            onChange={(e) => updateField("purchaseDate", e.target.value)}
            className={inputClass}
          />
          {errors.purchaseDate && (
            <p className="mt-1 text-sm text-red-500">{errors.purchaseDate}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            商品名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={values.productName}
            onChange={(e) => updateField("productName", e.target.value)}
            placeholder="例：本鑑定"
            className={inputClass}
          />
          {errors.productName && (
            <p className="mt-1 text-sm text-red-500">{errors.productName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            購入金額（円） <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={values.amount ?? ""}
            onChange={(e) =>
              updateField(
                "amount",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            placeholder="例：6980"
            className={inputClass}
          />
          {errors.amount && (
            <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            購入経路・決済方法
          </label>
          <input
            type="text"
            value={values.paymentMethod}
            onChange={(e) => updateField("paymentMethod", e.target.value)}
            placeholder="例：LINE Pay、銀行振込など"
            className={inputClass}
          />
          {errors.paymentMethod && (
            <p className="mt-1 text-sm text-red-500">{errors.paymentMethod}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            ヒアリング内容
          </label>
          <textarea
            value={values.hearingContent}
            onChange={(e) => updateField("hearingContent", e.target.value)}
            rows={10}
            placeholder="LINEで聞いた内容をそのまま貼り付けできます"
            className={inputClass}
          />
          {errors.hearingContent && (
            <p className="mt-1 text-sm text-red-500">{errors.hearingContent}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            送付した鑑定文
          </label>
          <textarea
            value={values.readingContent}
            onChange={(e) => updateField("readingContent", e.target.value)}
            rows={12}
            className={inputClass}
          />
          {errors.readingContent && (
            <p className="mt-1 text-sm text-red-500">{errors.readingContent}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            鑑定文送付日時
          </label>
          <input
            type="datetime-local"
            value={values.sentAt}
            onChange={(e) => updateField("sentAt", e.target.value)}
            className={inputClass}
          />
          {errors.sentAt && (
            <p className="mt-1 text-sm text-red-500">{errors.sentAt}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            メモ
          </label>
          <textarea
            value={values.memo}
            onChange={(e) => updateField("memo", e.target.value)}
            rows={3}
            className={inputClass}
          />
          {errors.memo && (
            <p className="mt-1 text-sm text-red-500">{errors.memo}</p>
          )}
        </div>

        {errors._form && <p className="text-sm text-red-500">{errors._form}</p>}

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isSubmitting ? "保存中..." : target ? "更新する" : "追加する"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
