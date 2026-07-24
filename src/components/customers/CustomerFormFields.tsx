"use client";

import { CustomerFormValues, GENDER_OPTIONS } from "@/types/customer";

interface CustomerFormFieldsProps {
  values: CustomerFormValues;
  onChange: <K extends keyof CustomerFormValues>(
    field: K,
    value: CustomerFormValues[K],
  ) => void;
}

export function CustomerFormFields({ values, onChange }: CustomerFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-zinc-700">
          鑑定名（ニックネーム） <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.readingName}
          onChange={(e) => onChange("readingName", e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-zinc-700">
          LINE表示名
        </label>
        <input
          type="text"
          value={values.lineName}
          onChange={(e) => onChange("lineName", e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-zinc-700">
          本名
        </label>
        <input
          type="text"
          value={values.realName}
          onChange={(e) => onChange("realName", e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-zinc-700">
          LINE User ID
        </label>
        <input
          type="text"
          value={values.lineUserId}
          onChange={(e) => onChange("lineUserId", e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-zinc-700">
          年齢
        </label>
        <input
          type="number"
          value={values.age}
          onChange={(e) => onChange("age", e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-zinc-700">
          性別
        </label>
        <select
          value={values.gender}
          onChange={(e) => onChange("gender", e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="">未選択</option>
          {GENDER_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-zinc-700">
          生年月日
        </label>
        <input
          type="date"
          value={values.birthday}
          onChange={(e) => onChange("birthday", e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>
    </div>
  );
}
