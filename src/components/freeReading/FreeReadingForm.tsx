"use client";

import { FormEvent, useState } from "react";
import { submitFreeReadingRequest } from "@/lib/freeReadingRequests/actions";
import {
  CONTENT_MAX_LENGTH,
  IDEAL_FUTURE_MAX_LENGTH,
  INSTAGRAM_USERNAME_MAX_LENGTH,
  LINE_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PARTNER_NAME_MAX_LENGTH,
} from "@/lib/freeReadingRequests/validation";
import {
  ContactMethod,
  EMPTY_FREE_READING_FORM_VALUES,
  FreeReadingFormValues,
  GENDER_OPTIONS,
  PARTNER_GENDER_OPTIONS,
} from "@/types/freeReadingRequest";

const inputClassName =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

export function FreeReadingForm() {
  const [values, setValues] = useState<FreeReadingFormValues>(
    EMPTY_FREE_READING_FORM_VALUES,
  );
  const [honeypot, setHoneypot] = useState("");
  const [formLoadedAt] = useState(() => Date.now());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function updateField<K extends keyof FreeReadingFormValues>(
    field: K,
    value: FreeReadingFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function selectContactMethod(method: ContactMethod) {
    setValues((prev) => ({ ...prev, contactMethod: method }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    try {
      const result = await submitFreeReadingRequest(values, {
        honeypot,
        formLoadedAt,
      });
      if (result.ok) {
        setIsSubmitted(true);
      } else {
        setErrors(result.errors);
      }
    } catch {
      setErrors({ _form: "送信に失敗しました。時間をおいて再度お試しください。" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-5 py-8 text-center">
        <p className="text-base font-medium text-zinc-900">
          送信が完了しました
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          お申し込みありがとうございます。ご入力いただいた連絡先へ追ってご案内いたします。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* ハニーポット: 人間には見えない項目。botが埋めた場合はスパムとみなす */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] top-0 opacity-0"
      >
        <label htmlFor="website">website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">あなたについて</h2>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          お名前 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => updateField("name", e.target.value)}
          maxLength={NAME_MAX_LENGTH}
          required
          className={inputClassName}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          生年月日 <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={values.birthDate}
          onChange={(e) => updateField("birthDate", e.target.value)}
          required
          className={inputClassName}
        />
        {errors.birthDate && (
          <p className="mt-1 text-sm text-red-500">{errors.birthDate}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          性別 <span className="text-red-500">*</span>
        </label>
        <select
          value={values.gender}
          onChange={(e) => updateField("gender", e.target.value)}
          required
          className={inputClassName}
        >
          <option value="">選択してください</option>
          {GENDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.gender && (
          <p className="mt-1 text-sm text-red-500">{errors.gender}</p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">お相手について</h2>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          お相手のお名前
        </label>
        <input
          type="text"
          value={values.partnerName}
          onChange={(e) => updateField("partnerName", e.target.value)}
          maxLength={PARTNER_NAME_MAX_LENGTH}
          className={inputClassName}
        />
        {errors.partnerName && (
          <p className="mt-1 text-sm text-red-500">{errors.partnerName}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          お相手の生年月日
        </label>
        <input
          type="date"
          value={values.partnerBirthDate}
          onChange={(e) => updateField("partnerBirthDate", e.target.value)}
          className={inputClassName}
        />
        {errors.partnerBirthDate && (
          <p className="mt-1 text-sm text-red-500">
            {errors.partnerBirthDate}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          お相手の性別
        </label>
        <select
          value={values.partnerGender}
          onChange={(e) => updateField("partnerGender", e.target.value)}
          className={inputClassName}
        >
          <option value="">選択してください</option>
          {PARTNER_GENDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.partnerGender && (
          <p className="mt-1 text-sm text-red-500">{errors.partnerGender}</p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">ご相談</h2>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          今悩んでいること <span className="text-red-500">*</span>
        </label>
        <textarea
          value={values.content}
          onChange={(e) => updateField("content", e.target.value)}
          maxLength={CONTENT_MAX_LENGTH}
          required
          rows={5}
          className={inputClassName}
        />
        {errors.content && (
          <p className="mt-1 text-sm text-red-500">{errors.content}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          どうなっていたら理想的か <span className="text-red-500">*</span>
        </label>
        <textarea
          value={values.idealFuture}
          onChange={(e) => updateField("idealFuture", e.target.value)}
          maxLength={IDEAL_FUTURE_MAX_LENGTH}
          required
          rows={5}
          className={inputClassName}
        />
        {errors.idealFuture && (
          <p className="mt-1 text-sm text-red-500">{errors.idealFuture}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          鑑定方法 <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => selectContactMethod("line")}
            className={`rounded-md border px-4 py-3 text-sm font-medium ${
              values.contactMethod === "line"
                ? "border-violet-600 bg-violet-50 text-violet-700"
                : "border-zinc-300 text-zinc-600"
            }`}
          >
            LINE
          </button>
          <button
            type="button"
            onClick={() => selectContactMethod("instagram")}
            className={`rounded-md border px-4 py-3 text-sm font-medium ${
              values.contactMethod === "instagram"
                ? "border-violet-600 bg-violet-50 text-violet-700"
                : "border-zinc-300 text-zinc-600"
            }`}
          >
            Instagram
          </button>
        </div>
        {errors.contactMethod && (
          <p className="mt-1 text-sm text-red-500">{errors.contactMethod}</p>
        )}
      </div>

      {values.contactMethod === "line" && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            LINE表示名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={values.lineName}
            onChange={(e) => updateField("lineName", e.target.value)}
            maxLength={LINE_NAME_MAX_LENGTH}
            required
            className={inputClassName}
          />
          {errors.lineName && (
            <p className="mt-1 text-sm text-red-500">{errors.lineName}</p>
          )}
        </div>
      )}

      {values.contactMethod === "instagram" && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Instagram ID（@は不要） <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={values.instagramUsername}
            onChange={(e) => updateField("instagramUsername", e.target.value)}
            maxLength={INSTAGRAM_USERNAME_MAX_LENGTH + 1}
            required
            autoCapitalize="none"
            className={inputClassName}
          />
          {errors.instagramUsername && (
            <p className="mt-1 text-sm text-red-500">
              {errors.instagramUsername}
            </p>
          )}
        </div>
      )}

      {errors._form && (
        <p className="text-sm text-red-500">{errors._form}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-violet-600 px-4 py-3 text-base font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {isSubmitting ? "送信中..." : "送信する"}
      </button>
    </form>
  );
}
