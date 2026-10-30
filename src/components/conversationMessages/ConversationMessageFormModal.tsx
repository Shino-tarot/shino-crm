"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  ConversationDirection,
  ConversationMessage,
  ConversationMessageFormValues,
} from "@/types/conversationMessage";
import { toDateTimeLocalInput } from "@/lib/format";
import { BODY_MAX_LENGTH } from "@/lib/conversationMessages/validation";

interface ConversationMessageFormModalProps {
  target: ConversationMessage | null;
  onClose: () => void;
  onSubmit: (
    values: ConversationMessageFormValues,
  ) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
}

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm";

const DIRECTION_OPTIONS: {
  value: ConversationDirection;
  label: string;
  selectedClass: string;
}[] = [
  {
    value: "incoming",
    label: "受信（お客様から）",
    selectedClass: "border-zinc-500 bg-zinc-100 text-zinc-900",
  },
  {
    value: "outgoing",
    label: "送信（鯛子から）",
    selectedClass: "border-violet-500 bg-violet-50 text-violet-800",
  },
];

export function ConversationMessageFormModal({
  target,
  onClose,
  onSubmit,
}: ConversationMessageFormModalProps) {
  const [values, setValues] = useState<ConversationMessageFormValues>(() =>
    target
      ? {
          direction: target.direction,
          sentAt: toDateTimeLocalInput(target.sentAt),
          body: target.body,
        }
      : {
          direction: "",
          sentAt: toDateTimeLocalInput(new Date().toISOString()),
          body: "",
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof ConversationMessageFormValues>(
    field: K,
    value: ConversationMessageFormValues[K],
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
    } catch {
      setErrors({ _form: "保存に失敗しました。時間をおいて再度お試しください。" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={target ? "会話履歴を編集" : "会話履歴を手動登録"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset>
          <legend className="block text-sm font-medium text-zinc-700">
            送受信 <span className="text-red-500">*</span>
          </legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {DIRECTION_OPTIONS.map((option) => {
              const selected = values.direction === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateField("direction", option.value)}
                  className={`rounded-md border px-2 py-3 text-sm font-medium ${
                    selected
                      ? option.selectedClass
                      : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {errors.direction && (
            <p className="mt-1 text-sm text-red-500">{errors.direction}</p>
          )}
        </fieldset>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            送受信日時 <span className="text-red-500">*</span>
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
            本文 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={values.body}
            onChange={(e) => updateField("body", e.target.value)}
            rows={8}
            placeholder="LINE公式アプリでメッセージを長押し →「コピー」して、ここに貼り付けてください"
            className={inputClass}
          />
          <p
            className={`mt-1 text-right text-xs ${
              values.body.length > BODY_MAX_LENGTH ? "text-red-500" : "text-zinc-400"
            }`}
          >
            {values.body.length.toLocaleString("ja-JP")} /{" "}
            {BODY_MAX_LENGTH.toLocaleString("ja-JP")}文字
          </p>
          {errors.body && <p className="mt-1 text-sm text-red-500">{errors.body}</p>}
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
            {isSubmitting ? "保存中..." : target ? "更新する" : "登録する"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
