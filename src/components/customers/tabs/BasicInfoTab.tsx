"use client";

import { FormEvent, useState } from "react";
import { CustomerFormFields } from "@/components/customers/CustomerFormFields";
import { formatDate } from "@/lib/format";
import { Customer, CustomerFormValues } from "@/types/customer";

interface BasicInfoTabProps {
  customer: Customer;
  onUpdate: (values: CustomerFormValues) => Promise<void>;
}

function toFormValues(customer: Customer): CustomerFormValues {
  return {
    lineName: customer.lineName,
    readingName: customer.readingName,
    realName: customer.realName,
    lineUserId: customer.lineUserId,
    age: customer.age,
    gender: customer.gender,
    birthday: customer.birthday,
  };
}

const DISPLAY_FIELDS: { label: string; key: keyof CustomerFormValues }[] = [
  { label: "鑑定名（ニックネーム）", key: "readingName" },
  { label: "LINE表示名", key: "lineName" },
  { label: "本名", key: "realName" },
  { label: "LINE User ID", key: "lineUserId" },
  { label: "年齢", key: "age" },
  { label: "性別", key: "gender" },
  { label: "生年月日", key: "birthday" },
];

export function BasicInfoTab({ customer, onUpdate }: BasicInfoTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<CustomerFormValues>(
    toFormValues(customer),
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function startEdit() {
    setValues(toFormValues(customer));
    setError("");
    setIsEditing(true);
  }

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
      await onUpdate(values);
      setIsEditing(false);
    } catch {
      setError("更新に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <CustomerFormFields values={values} onChange={updateField} />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
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
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={startEdit}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          編集する
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        {DISPLAY_FIELDS.map((field) => (
          <div key={field.key}>
            <dt className="text-xs text-zinc-400">{field.label}</dt>
            <dd className="mt-0.5 text-sm text-zinc-900">
              {field.key === "birthday"
                ? formatDate(customer.birthday) || "-"
                : customer[field.key] || "-"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
