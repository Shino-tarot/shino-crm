// ステータス自動更新の判定ルール(DBアクセスを含まない純粋な関数のみ)。

export type AutoUpdateEventType = "free_reading_sent" | "paid_reading_sent";

// 自動更新で「先の段階へ進める」判定に使う進行順。
// ここに無いステータス(archived=対応不要 / completed=完了)は自動更新の対象外。
const STATUS_PROGRESS_ORDER = [
  "new",
  "contacted",
  "awaiting_free_reading",
  "in_reading",
  "free_reading_sent",
  "paid_reading_proposed",
  "converted",
  "paid_reading_sent",
];

export const AUTO_UPDATE_TARGET_STATUS: Record<AutoUpdateEventType, string> = {
  free_reading_sent: "free_reading_sent",
  paid_reading_sent: "paid_reading_sent",
};

// 現在のステータスを、送信イベントの目標ステータスへ進めてよいか。
// 対象外ステータス・すでに同じか先の段階にいる場合はfalse(過去の段階には戻さない)。
export function shouldAdvanceStatus(
  currentStatus: string,
  targetStatus: string,
): boolean {
  const currentIndex = STATUS_PROGRESS_ORDER.indexOf(currentStatus);
  const targetIndex = STATUS_PROGRESS_ORDER.indexOf(targetStatus);
  if (currentIndex === -1 || targetIndex === -1) return false;
  return currentIndex < targetIndex;
}

// 自動更新の対象となる送信イベントか(送信日時を過ぎていて、かつ機能導入以降の送信)。
export function isDueSendEvent(
  sentAt: string | null,
  launchedAt: string,
  now: Date,
): boolean {
  if (!sentAt) return false;
  const sentTime = new Date(sentAt).getTime();
  return sentTime <= now.getTime() && sentTime >= new Date(launchedAt).getTime();
}

// 送信日時が未来(「送信予約中」バッジを表示する状態)か。
export function isScheduledSend(sentAt: string | null, now: Date): boolean {
  if (!sentAt) return false;
  return new Date(sentAt).getTime() > now.getTime();
}
