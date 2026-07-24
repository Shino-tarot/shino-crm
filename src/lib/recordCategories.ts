export type RecordCategory =
  | "consultation"
  | "freeReading"
  | "formalReading"
  | "purchase"
  | "memo";

export interface RecordCategoryConfig {
  key: RecordCategory;
  label: string;
  hasAmount: boolean;
  emptyMessage: string;
}

export const RECORD_CATEGORIES: RecordCategoryConfig[] = [
  {
    key: "consultation",
    label: "相談内容",
    hasAmount: false,
    emptyMessage: "相談内容の記録はまだありません。",
  },
  {
    key: "freeReading",
    label: "無料鑑定",
    hasAmount: false,
    emptyMessage: "無料鑑定の記録はまだありません。",
  },
  {
    key: "formalReading",
    label: "本鑑定",
    hasAmount: true,
    emptyMessage: "本鑑定の記録はまだありません。",
  },
  {
    key: "purchase",
    label: "購入履歴",
    hasAmount: true,
    emptyMessage: "購入履歴はまだありません。",
  },
  {
    key: "memo",
    label: "メモ",
    hasAmount: false,
    emptyMessage: "メモはまだありません。",
  },
];
