import { GENDER_OPTIONS, PARTNER_GENDER_OPTIONS } from "@/types/freeReadingRequest";

export const GENDER_LABELS: Record<string, string> = Object.fromEntries(
  GENDER_OPTIONS.map((option) => [option.value, option.label]),
);

export const PARTNER_GENDER_LABELS: Record<string, string> = Object.fromEntries(
  PARTNER_GENDER_OPTIONS.map((option) => [option.value, option.label]),
);

// 既存4ステータス(new/contacted/converted/archived)は変更・削除しない
// (公開フォーム(/free-reading)からの申込がDB default('new')に依存しているため)。
// 診断Webアプリ連携の撤去に伴い、診断専用ステータス(diagnosis_completed /
// awaiting_line_registration)は削除。CRMの鑑定進行管理として使うステータスは残す。
export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new: { label: "新規", className: "bg-violet-100 text-violet-700" },
  contacted: { label: "連絡済み", className: "bg-amber-100 text-amber-700" },
  converted: { label: "顧客化済み", className: "bg-green-100 text-green-700" },
  archived: { label: "対応不要", className: "bg-zinc-100 text-zinc-500" },
  awaiting_free_reading: {
    label: "無料鑑定待ち",
    className: "bg-orange-100 text-orange-700",
  },
  in_reading: { label: "鑑定中", className: "bg-fuchsia-100 text-fuchsia-700" },
  free_reading_sent: {
    label: "無料鑑定送信済み",
    className: "bg-teal-100 text-teal-700",
  },
  paid_reading_proposed: {
    label: "本鑑定案内済み",
    className: "bg-rose-100 text-rose-700",
  },
  completed: { label: "完了", className: "bg-emerald-100 text-emerald-700" },
};

// 既存データ保持のためDB・バリデーション上は有効なままだが、通常の選択肢には出さないステータス
const HIDDEN_STATUS_VALUES = ["completed"];

const ALL_STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(
  ([value, info]) => ({ value, label: info.label }),
);

// 編集画面用の選択肢。すでに非表示ステータスが設定されている申込では、
// 現在値が選択肢から消えて別の値に変わってしまわないよう、その値だけ残す
export function getStatusOptionsFor(currentStatus: string) {
  return ALL_STATUS_OPTIONS.filter(
    (option) =>
      !HIDDEN_STATUS_VALUES.includes(option.value) ||
      option.value === currentStatus,
  );
}

// 詳細希望(detail_request)。DBではNULL=未回答 / 'yes'=あり / 'no'=なし で保存する
export const DETAIL_REQUEST_OPTIONS = [
  { value: null, label: "未回答" },
  { value: "yes", label: "あり" },
  { value: "no", label: "なし" },
] as const;

export type DetailRequestValue = (typeof DETAIL_REQUEST_OPTIONS)[number]["value"];

export const CONTACT_METHOD_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  line: { label: "LINE", className: "bg-emerald-100 text-emerald-700" },
  instagram: { label: "Instagram", className: "bg-pink-100 text-pink-700" },
};
