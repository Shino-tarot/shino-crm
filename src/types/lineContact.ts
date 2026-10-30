import { LinkBlockReason } from "@/lib/lineContacts/rules";

// friend=友だち / blocked=ブロック中 / unknown=不明
export type LineFriendStatus = "friend" | "blocked" | "unknown";

// 紐づけ先の顧客(画面表示用。LINEユーザーIDは画面に渡さない)
export interface LinkedCustomer {
  id: string;
  customerNo: number;
  readingName: string;
  lineName: string;
  realName: string;
}

// LINE送信者(line_contacts)。LINEユーザーIDはサーバー内でのみ扱い、画面には渡さない
export interface LineContact {
  id: string;
  displayName: string;
  pictureUrl: string | null;
  friendStatus: LineFriendStatus;
  lastMessageAt: string | null;
  linkedAt: string | null;
  createdAt: string;
  messageCount: number;
  customer: LinkedCustomer | null;
}

// 紐づけ先の候補(顧客検索の結果)
export interface LinkCandidate extends LinkedCustomer {
  // 紐づけできない理由。nullなら紐づけ可能
  blockReason: LinkBlockReason | null;
  // 顧客に登録済みのLINEユーザーIDが、この送信者と一致する(参考表示のみ。自動で紐づけはしない)
  lineUserIdMatches: boolean;
}
