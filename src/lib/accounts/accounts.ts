// CRMで切り替えて管理するアカウント(DBの accounts テーブルと同じ内容。0016_accounts_additive.sql)。
// 顧客・鑑定・LINE履歴・通知はアカウントごとに完全に分離し、アカウントをまたぐ統合はしない。
// DBに依存しない純粋な定義のみ(単体テスト・クライアントからも使う)。

export const ACCOUNTS = [
  { id: "taiko", label: "鯛子", bannerClassName: "bg-violet-600 text-white" },
  { id: "yayoi", label: "夜宵", bannerClassName: "bg-indigo-900 text-white" },
] as const;

export type AccountId = (typeof ACCOUNTS)[number]["id"];

// アカウント未選択(cookieなし・不正な値)のときに表示するアカウント
export const DEFAULT_ACCOUNT_ID: AccountId = "taiko";

// LINE Webhook・公開の申込フォームで受け取ったデータの保存先。
// 現在のLINEチャネル(鯛子CRMテスト)と申込フォームは鯛子専用のため、当面は鯛子に固定する。
// 夜宵のLINE・申込フォームは、本番用LINEプロバイダーの準備後に別の受け口として追加する。
export const INBOUND_ACCOUNT_ID: AccountId = "taiko";

// 選択中のアカウントを保存するcookie名
export const ACCOUNT_COOKIE_NAME = "crm_account";

export const ACCOUNT_MISMATCH_MESSAGE =
  "別のタブまたは画面でアカウントが切り替えられたため、保存を中止しました。画面を再読み込みしてください。";

export function isAccountId(value: unknown): value is AccountId {
  return typeof value === "string" && ACCOUNTS.some((account) => account.id === value);
}

// cookieの値からアカウントを決める(未設定・不正な値は既定のアカウント)
export function resolveAccountId(cookieValue: string | undefined | null): AccountId {
  return isAccountId(cookieValue) ? cookieValue : DEFAULT_ACCOUNT_ID;
}

export function getAccount(id: AccountId) {
  return ACCOUNTS.find((account) => account.id === id) ?? ACCOUNTS[0];
}

export function accountLabel(id: AccountId): string {
  return getAccount(id).label;
}

// 画面を表示したときのアカウント(expected)と、現在選択中のアカウント(current)が一致するか。
// 別のタブで切り替えた後に古いタブから保存した場合などに、誤ったアカウントへ保存しないために使う
export function isSameAccount(expected: unknown, current: AccountId): boolean {
  return isAccountId(expected) && expected === current;
}
