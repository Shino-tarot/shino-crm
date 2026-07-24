import {
  GENDER_OPTIONS,
  PARTNER_GENDER_OPTIONS,
} from "@/types/freeReadingRequest";

export const GENDER_LABELS: Record<string, string> = Object.fromEntries(
  GENDER_OPTIONS.map((option) => [option.value, option.label]),
);

export const PARTNER_GENDER_LABELS: Record<string, string> = Object.fromEntries(
  PARTNER_GENDER_OPTIONS.map((option) => [option.value, option.label]),
);

export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new: { label: "新規", className: "bg-violet-100 text-violet-700" },
  contacted: { label: "連絡済み", className: "bg-amber-100 text-amber-700" },
  converted: { label: "顧客化済み", className: "bg-green-100 text-green-700" },
  archived: { label: "対応不要", className: "bg-zinc-100 text-zinc-500" },
};

export const CONTACT_METHOD_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  line: { label: "LINE", className: "bg-emerald-100 text-emerald-700" },
  instagram: { label: "Instagram", className: "bg-pink-100 text-pink-700" },
};
