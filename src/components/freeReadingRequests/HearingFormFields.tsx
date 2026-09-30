"use client";

import { HearingFormValues } from "@/types/freeReadingRequest";
import { STATUS_OPTIONS } from "@/lib/freeReadingRequests/labels";
import { CopyButton } from "@/components/ui/CopyButton";

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

const sectionHeadingClass =
  "text-sm font-semibold text-zinc-900 border-b border-zinc-200 pb-2";

export function HearingFormFields({
  values,
  onChange,
  errors = {},
}: HearingFormFieldsProps) {
  return (
    <div className="space-y-8">
      {/* お客様情報 */}
      <div className="space-y-4">
        <h2 className={sectionHeadingClass}>お客様情報</h2>

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
            生年月日
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
      </div>

      {/* お相手情報 */}
      <div className="space-y-4">
        <h2 className={sectionHeadingClass}>お相手情報</h2>

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
      </div>

      {/* 無料鑑定ヒアリング */}
      <div className="space-y-4">
        <h2 className={sectionHeadingClass}>無料鑑定ヒアリング</h2>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            今のお悩み
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
      </div>

      {/* 送付した無料鑑定文 */}
      <div className="space-y-4">
        <h2 className={sectionHeadingClass}>送付した無料鑑定文</h2>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-zinc-700">
              無料鑑定文
            </label>
            {values.sentReadingContent && (
              <CopyButton text={values.sentReadingContent} />
            )}
          </div>
          <textarea
            value={values.sentReadingContent}
            onChange={(e) => onChange("sentReadingContent", e.target.value)}
            rows={12}
            placeholder="実際にお客様へ送付した無料鑑定文を貼り付けて保存できます"
            className={inputClass}
          />
          {errors.sentReadingContent && (
            <p className="mt-1 text-sm text-red-500">
              {errors.sentReadingContent}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            送付日時
          </label>
          <input
            type="datetime-local"
            value={values.sentAt}
            onChange={(e) => onChange("sentAt", e.target.value)}
            className={inputClass}
          />
          {errors.sentAt && (
            <p className="mt-1 text-sm text-red-500">{errors.sentAt}</p>
          )}
        </div>
      </div>

      {/* 対応情報 */}
      <div className="space-y-4">
        <h2 className={sectionHeadingClass}>対応情報</h2>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            申込日
          </label>
          <input
            type="date"
            value={values.applicationDate}
            onChange={(e) => onChange("applicationDate", e.target.value)}
            className={inputClass}
          />
          {errors.applicationDate && (
            <p className="mt-1 text-sm text-red-500">{errors.applicationDate}</p>
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
      </div>
    </div>
  );
}
