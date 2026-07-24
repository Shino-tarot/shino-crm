"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CustomerFormFields } from "@/components/customers/CustomerFormFields";
import {
  CustomerFormValues,
  EMPTY_CUSTOMER_FORM_VALUES,
} from "@/types/customer";

interface CustomerCreateModalProps {
  onClose: () => void;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
}

export function CustomerCreateModal({
  onClose,
  onSubmit,
}: CustomerCreateModalProps) {
  const [values, setValues] = useState<CustomerFormValues>(
    EMPTY_CUSTOMER_FORM_VALUES,
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof CustomerFormValues>(
    field: K,
    value: CustomerFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.readingName.trim()) {
      setError("鑑定名を入力してください。");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch {
      setError("登録に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="新規顧客登録" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <CustomerFormFields values={values} onChange={updateField} />

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
            {isSubmitting ? "登録中..." : "登録する"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
