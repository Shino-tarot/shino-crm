"use client";

import { HearingFormValues } from "@/types/freeReadingRequest";
import { STATUS_OPTIONS } from "@/lib/freeReadingRequests/labels";

interface HearingFormFieldsProps {
  values: HearingFormValues;
  onChange: <K extends keyof HearingFormValues>(
    field: K,
    value: HearingFormValues[K],
  ) => void;
  errors?: Record<string, string>;
}

// スマホでの入力しやすさを優先し、1カラム縦積みレイアウトにしている
// (他画面の2カラムグリッドとは意図的に異なる)。
const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm";

export function HearingFormFields({
  values,
  onChange,
  errors = {},
}: HearingFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          LINE表示名
        </label>
        <input
          type="text"
          value={values.lineName}
          onChange={(e) => onChange("lineName", e.target.value)}
          className={inputClass}
        />
        {errors.lineName && (
          <p className="mt-1 text-sm text-red-500">{errors.lineName}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          相談者名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => onChange("name", e.target.value)}
          className={inputClass}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          相談者生年月日
        </label>
        <input
          type="date"
          value={values.birthDate}
          onChange={(e) => onChange("birthDate", e.target.value)}
          className={inputClass}
        />
        {errors.birthDate && (
          <p className="mt-1 text-sm text-red-500">{errors.birthDate}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          相手の名前
        </label>
        <input
          type="text"
          value={values.partnerName}
          onChange={(e) => onChange("partnerName", e.target.value)}
          className={inputClass}
        />
        {errors.partnerName && (
          <p className="mt-1 text-sm text-red-500">{errors.partnerName}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          相手の生年月日
        </label>
        <input
          type="date"
          value={values.partnerBirthDate}
          onChange={(e) => onChange("partnerBirthDate", e.target.value)}
          className={inputClass}
        />
        {errors.partnerBirthDate && (
          <p className="mt-1 text-sm text-red-500">
            {errors.partnerBirthDate}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          悩み
        </label>
        <textarea
          value={values.content}
          onChange={(e) => onChange("content", e.target.value)}
          rows={4}
          className={inputClass}
        />
        {errors.content && (
          <p className="mt-1 text-sm text-red-500">{errors.content}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          理想の未来
        </label>
        <textarea
          value={values.idealFuture}
          onChange={(e) => onChange("idealFuture", e.target.value)}
          rows={4}
          className={inputClass}
        />
        {errors.idealFuture && (
          <p className="mt-1 text-sm text-red-500">{errors.idealFuture}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          メモ
        </label>
        <textarea
          value={values.memo}
          onChange={(e) => onChange("memo", e.target.value)}
          rows={3}
          placeholder="対応状況や気づいたことなど"
          className={inputClass}
        />
        {errors.memo && (
          <p className="mt-1 text-sm text-red-500">{errors.memo}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          ステータス
        </label>
        <select
          value={values.status}
          onChange={(e) => onChange("status", e.target.value)}
          className={inputClass}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.status && (
          <p className="mt-1 text-sm text-red-500">{errors.status}</p>
        )}
      </div>
    </div>
  );
}
