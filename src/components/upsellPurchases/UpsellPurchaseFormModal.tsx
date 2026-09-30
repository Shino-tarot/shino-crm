"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  EMPTY_UPSELL_PURCHASE_FORM_VALUES,
  UpsellPurchase,
  UpsellPurchaseFormValues,
} from "@/types/upsellPurchase";
import { getTodayDateString } from "@/lib/format";

interface UpsellPurchaseFormModalProps {
  target: UpsellPurchase | null;
  onClose: () => void;
  onSubmit: (
    values: UpsellPurchaseFormValues,
  ) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
}

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm";

export function UpsellPurchaseFormModal({
  target,
  onClose,
  onSubmit,
}: UpsellPurchaseFormModalProps) {
  const [values, setValues] = useState<UpsellPurchaseFormValues>(
    target
      ? {
          purchaseDate: target.purchaseDate,
          productName: target.productName,
          productType: target.productType,
          amount: target.amount,
          memo: target.memo,
        }
      : {
          ...EMPTY_UPSELL_PURCHASE_FORM_VALUES,
          purchaseDate: getTodayDateString(),
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof UpsellPurchaseFormValues>(
    field: K,
    value: UpsellPurchaseFormValues[K],
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
    <Modal
      title={target ? "アップセル購入を編集" : "アップセル購入を追加"}
      onClose={onClose}
    >
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
            placeholder="例：ご縁好転ヒーリング"
            className={inputClass}
          />
          {errors.productName && (
            <p className="mt-1 text-sm text-red-500">{errors.productName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            商品種別
          </label>
          <input
            type="text"
            value={values.productType}
            onChange={(e) => updateField("productType", e.target.value)}
            placeholder="例：ヒーリング、継続鑑定、パワーストーンなど"
            className={inputClass}
          />
          {errors.productType && (
            <p className="mt-1 text-sm text-red-500">{errors.productType}</p>
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
            placeholder="例：29800"
            className={inputClass}
          />
          {errors.amount && (
            <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
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
