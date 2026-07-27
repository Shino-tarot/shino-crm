"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LineHearingPasteBox } from "@/components/freeReadingRequests/LineHearingPasteBox";
import { HearingFormFields } from "@/components/freeReadingRequests/HearingFormFields";
import { updateHearingRequest } from "@/lib/freeReadingRequests/actions";
import { HearingFormValues } from "@/types/freeReadingRequest";
import { ParsedHearing } from "@/lib/freeReadingRequests/parseHearingText";
import { formatDateTime } from "@/lib/format";

interface HearingDetailClientProps {
  id: string;
  initialValues: HearingFormValues;
  createdAt: string;
}

export function HearingDetailClient({
  id,
  initialValues,
  createdAt,
}: HearingDetailClientProps) {
  const [values, setValues] = useState<HearingFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

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
          申込日時: {formatDateTime(createdAt)}
        </p>
        <h1 className="text-xl font-semibold text-zinc-900">
          {values.name || "（未入力）"}
        </h1>
      </div>

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
    </div>
  );
}
