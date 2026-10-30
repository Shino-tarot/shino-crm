// 無料鑑定送信24時間後フォロー通知の判定ルール(DBアクセスを含まない純粋な関数のみ)。

export const FOLLOW_UP_DELAY_MS = 24 * 60 * 60 * 1000;

// 対応不要・完了の申込はフォロー通知の対象外
export const FOLLOW_UP_EXCLUDED_STATUSES = ["archived", "completed"];

export interface FollowUpCandidate {
  status: string;
  sent_at: string | null;
  detail_request?: string | null;
  followed_up_at?: string | null;
  // 紐づく顧客が非表示(論理削除)中か。非表示中は通知対象外、復元すると通常の条件で再び対象になる
  customer_hidden?: boolean;
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
  if (candidate.customer_hidden) return null;
  if (FOLLOW_UP_EXCLUDED_STATUSES.includes(candidate.status)) return null;

  const dueTime = new Date(candidate.sent_at).getTime() + FOLLOW_UP_DELAY_MS;
  if (dueTime > now.getTime()) return null;
  return dueTime >= new Date(launchedAt).getTime() ? "new" : "past";
}

export interface FollowUpRow extends FollowUpCandidate {
  id: string;
  account_id: string;
}

// 表示中のアカウントの通知(新規・過去分)と、他のアカウントの新規通知の件数に分ける。
// 他のアカウントの申込は件数だけを数え、内容(名前など)は返さない(アカウント間で混在させない)
export function partitionFollowUpsByAccount<T extends FollowUpRow>(
  rows: T[],
  accountId: string,
  launchedAt: string,
  now: Date,
): { newRows: T[]; pastRows: T[]; otherAccountNewCounts: Map<string, number> } {
  const newRows: T[] = [];
  const pastRows: T[] = [];
  const otherAccountNewCounts = new Map<string, number>();
  for (const row of rows) {
    const category = classifyFollowUp(row, launchedAt, now);
    if (!category) continue;
    if (row.account_id !== accountId) {
      if (category === "new") {
        otherAccountNewCounts.set(row.account_id, (otherAccountNewCounts.get(row.account_id) ?? 0) + 1);
      }
      continue;
    }
    (category === "new" ? newRows : pastRows).push(row);
  }
  return { newRows, pastRows, otherAccountNewCounts };
}
