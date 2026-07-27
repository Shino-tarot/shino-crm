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

export default function NewHearingPage() {
  const router = useRouter();
  const [values, setValues] = useState<HearingFormValues>(
    EMPTY_HEARING_FORM_VALUES,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);
    try {
      const result = await createHearingRequest(values);
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
        href="/customers/free-reading-requests"
        className="text-sm text-violet-600 hover:text-violet-800"
      >
        ← 無料鑑定申込一覧に戻る
      </Link>

      <h1 className="mt-3 mb-6 text-xl font-semibold text-zinc-900">
        無料鑑定ヒアリングを登録
      </h1>

      <LineHearingPasteBox onParsed={applyParsed} />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <HearingFormFields values={values} onChange={updateField} errors={errors} />

        {errors._form && <p className="text-sm text-red-500">{errors._form}</p>}

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <Link
            href="/customers/free-reading-requests"
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isSubmitting ? "登録中..." : "登録する"}
          </button>
        </div>
      </form>
    </div>
  );
}
