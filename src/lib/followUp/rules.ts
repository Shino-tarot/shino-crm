// 無料鑑定送信24時間後フォロー通知の判定ルール(DBアクセスを含まない純粋な関数のみ)。

export const FOLLOW_UP_DELAY_MS = 24 * 60 * 60 * 1000;

// 対応不要・完了の申込はフォロー通知の対象外
export const FOLLOW_UP_EXCLUDED_STATUSES = ["archived", "completed"];

export interface FollowUpCandidate {
  status: string;
  sent_at: string | null;
  detail_request?: string | null;
  followed_up_at?: string | null;
}

export type FollowUpCategory = "new" | "past" | null;

// 通知対象なら、送信から24時間経過した時点が機能導入日時以降かで
// 「新規通知(new)」か「過去分(past)」かを返す。対象外ならnull。
// 新規通知は経過日数で自動的に消えず、詳細希望の回答かフォロー済みになるまで残る。
export function classifyFollowUp(
  candidate: FollowUpCandidate,
  launchedAt: string,
  now: Date,
): FollowUpCategory {
  if (!candidate.sent_at) return null;
  if (candidate.detail_request) return null;
  if (candidate.followed_up_at) return null;
  if (FOLLOW_UP_EXCLUDED_STATUSES.includes(candidate.status)) return null;

  const dueTime = new Date(candidate.sent_at).getTime() + FOLLOW_UP_DELAY_MS;
  if (dueTime > now.getTime()) return null;
  return dueTime >= new Date(launchedAt).getTime() ? "new" : "past";
}
