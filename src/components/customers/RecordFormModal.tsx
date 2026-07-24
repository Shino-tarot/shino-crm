"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  CustomerRecord,
  CustomerRecordFormValues,
  EMPTY_RECORD_FORM_VALUES,
} from "@/types/customerRecord";

interface RecordFormModalProps {
  categoryLabel: string;
  hasAmount: boolean;
  record: CustomerRecord | null;
  onClose: () => void;
  onSubmit: (values: CustomerRecordFormValues) => Promise<void>;
}

export function RecordFormModal({
  categoryLabel,
  hasAmount,
  record,
  onClose,
  onSubmit,
}: RecordFormModalProps) {
  const [values, setValues] = useState<CustomerRecordFormValues>(
    record
      ? {
          date: record.date,
          title: record.title,
          content: record.content,
          amount: record.amount,
        }
      : EMPTY_RECORD_FORM_VALUES,
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof CustomerRecordFormValues>(
    field: K,
    value: CustomerRecordFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.date) {
      setError("日付を入力してください。");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch {
      setError("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={record ? `${categoryLabel}を編集` : `${categoryLabel}を追加`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className={hasAmount ? "col-span-1" : "col-span-2"}>
            <label className="block text-sm font-medium text-zinc-700">
              日付 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={values.date}
              onChange={(e) => updateField("date", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
          {hasAmount && (
            <div className="col-span-1">
              <label className="block text-sm font-medium text-zinc-700">
                金額
              </label>
              <input
                type="number"
                value={values.amount ?? ""}
                onChange={(e) =>
                  updateField(
                    "amount",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-700">
              タイトル
            </label>
            <input
              type="text"
              value={values.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-700">
              内容
            </label>
            <textarea
              value={values.content}
              onChange={(e) => updateField("content", e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

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
            {isSubmitting ? "保存中..." : record ? "更新する" : "追加する"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
