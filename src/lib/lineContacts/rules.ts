// LINE送信者と顧客の紐づけ判定(DBに依存しない純粋な関数のみ。単体テストの対象)。
// 最終的な重複・不一致の防止はDB側(0012_conversation_history.sqlのトリガー・UNIQUEインデックス)が担い、
// ここでは保存前に分かりやすい理由を画面へ返すために同じ条件を判定する。

export const SEARCH_QUERY_MAX_LENGTH = 50;
export const SEARCH_RESULT_LIMIT = 20;

export const DISPLAY_NAME_FALLBACK = "表示名未取得";

export type LinkBlockReason =
  // この顧客は非表示(論理削除)中
  | "customer_hidden"
  // この顧客は既に別のLINE送信者と紐づいている
  | "customer_already_linked"
  // この顧客には別のLINEユーザーIDが登録されている
  | "customer_has_other_line_user_id"
  // この送信者のLINEユーザーIDが、別の顧客に登録されている
  | "line_user_id_owned_by_other_customer";

export const LINK_BLOCK_MESSAGES: Record<LinkBlockReason, string> = {
  customer_hidden:
    "この顧客は非表示中のため紐づけできません。顧客管理で復元してから紐づけてください。",
  customer_already_linked: "この顧客は既に別のLINE送信者と紐づいています。",
  customer_has_other_line_user_id:
    "この顧客には別のLINEユーザーIDが登録されているため紐づけできません。",
  line_user_id_owned_by_other_customer:
    "このLINE送信者のLINEユーザーIDは別の顧客に登録されているため、その顧客以外には紐づけできません。",
};

// 検索キーワードを整える。空・長すぎる・文字列以外はnull(検索しない)
export function normalizeSearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.replace(/\u0000/g, "").trim();
  if (!query || query.length > SEARCH_QUERY_MAX_LENGTH) return null;
  return query;
}

// 部分一致検索(ilike)用のパターン。% _ \ は入力した文字そのものとして扱う
export function toIlikePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// 数字だけのキーワードは顧客番号としても検索する
export function parseCustomerNo(query: string): number | null {
  if (!/^\d{1,9}$/.test(query)) return null;
  return Number(query);
}

export function displayNameOrFallback(displayName: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  return name || DISPLAY_NAME_FALLBACK;
}

export function formatCustomerLabel(customer: {
  customerNo: number;
  readingName: string;
  lineName: string;
  realName: string;
}): string {
  const name =
    customer.readingName.trim() ||
    customer.lineName.trim() ||
    customer.realName.trim() ||
    "(名前未登録)";
  return `No.${customer.customerNo} ${name}`;
}

export interface LinkBlockInput {
  contactId: string;
  contactLineUserId: string;
  customerId: string;
  // 顧客に登録済みのLINEユーザーID(未登録は空文字)
  customerLineUserId: string;
  // この顧客が非表示(論理削除)中か
  customerHidden: boolean;
  // この顧客に既に紐づいているLINE送信者のid(無ければnull)
  customerLinkedContactId: string | null;
  // この送信者のLINEユーザーIDが登録されている顧客のid一覧
  lineUserIdOwnerCustomerIds: string[];
}

// 紐づけできない理由を返す(nullなら紐づけ可能)。DBトリガーと同じく前後の空白は無視して比較する
export function getLinkBlockReason(input: LinkBlockInput): LinkBlockReason | null {
  if (input.customerHidden) return "customer_hidden";
  if (
    input.customerLinkedContactId !== null &&
    input.customerLinkedContactId !== input.contactId
  ) {
    return "customer_already_linked";
  }
  const customerLineUserId = input.customerLineUserId.trim();
  if (customerLineUserId !== "" && customerLineUserId !== input.contactLineUserId) {
    return "customer_has_other_line_user_id";
  }
  if (input.lineUserIdOwnerCustomerIds.some((id) => id !== input.customerId)) {
    return "line_user_id_owned_by_other_customer";
  }
  return null;
}

// 保存時のDBエラーコードを画面用のメッセージへ変換する(DB側で拒否された場合の最後の砦)
export function linkErrorMessageFromDbCode(code: string | undefined): string {
  switch (code) {
    // UNIQUE違反: 1人の顧客に紐づけられるLINE送信者は1件まで
    case "23505":
      return LINK_BLOCK_MESSAGES.customer_already_linked;
    // トリガーによる拒否: LINEユーザーIDの不一致
    case "P0001":
      return "顧客に登録されたLINEユーザーIDと一致しないため紐づけできません。";
    // 外部キー違反: 顧客が削除済み
    case "23503":
      return "選択した顧客が見つかりません。画面を再読み込みしてください。";
    default:
      return "紐づけに失敗しました。時間をおいて再度お試しください。";
  }
}
