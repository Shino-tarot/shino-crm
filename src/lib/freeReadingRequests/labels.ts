import {
  DIAGNOSIS_THEMES,
  GENDER_OPTIONS,
  PARTNER_GENDER_OPTIONS,
} from "@/types/freeReadingRequest";

export const GENDER_LABELS: Record<string, string> = Object.fromEntries(
  GENDER_OPTIONS.map((option) => [option.value, option.label]),
);

export const PARTNER_GENDER_LABELS: Record<string, string> = Object.fromEntries(
  PARTNER_GENDER_OPTIONS.map((option) => [option.value, option.label]),
);

export const DIAGNOSIS_THEME_LABELS: Record<string, string> = Object.fromEntries(
  DIAGNOSIS_THEMES.map((theme) => [theme.value, theme.label]),
);

// 既存4ステータス(new/contacted/converted/archived)は変更・削除しない
// (公開フォーム(/free-reading)からの申込がDB default('new')に依存しているため)。
// 診断Webアプリ連携後の進行管理用ステータスを追加する。
export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new: { label: "新規", className: "bg-violet-100 text-violet-700" },
  contacted: { label: "連絡済み", className: "bg-amber-100 text-amber-700" },
  converted: { label: "顧客化済み", className: "bg-green-100 text-green-700" },
  archived: { label: "対応不要", className: "bg-zinc-100 text-zinc-500" },
  diagnosis_completed: {
    label: "診断完了",
    className: "bg-sky-100 text-sky-700",
  },
  awaiting_line_registration: {
    label: "LINE登録待ち",
    className: "bg-indigo-100 text-indigo-700",
  },
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
    label: "有料鑑定案内済み",
    className: "bg-rose-100 text-rose-700",
  },
  completed: { label: "完了", className: "bg-emerald-100 text-emerald-700" },
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(
  ([value, info]) => ({ value, label: info.label }),
);

export const CONTACT_METHOD_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  line: { label: "LINE", className: "bg-emerald-100 text-emerald-700" },
  instagram: { label: "Instagram", className: "bg-pink-100 text-pink-700" },
};
