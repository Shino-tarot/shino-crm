// 申込と顧客の対応の判定(DBに依存しない純粋な関数のみ。単体テストの対象)。

// 「同じLINE表示名の申込」の候補に出すか(前後の空白・大文字小文字の違いのみ無視した完全一致)。
// 部分一致(「【テスト】統合確認」と「【テスト】統合確認B」など)は別の表示名として扱う。
export function isSameLineName(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").trim().toLowerCase();
  return left !== "" && left === (b ?? "").trim().toLowerCase();
}

export type RequestCustomerMismatch = "name" | "birthday";

// 申込に書かれた名前・生年月日と、その申込が登録されている顧客の名前・生年月日の食い違い。
// 両方に値がある項目だけを比べる(片方が空なら食い違いとはしない)
export function requestCustomerMismatch(
  request: { name: string | null | undefined; birthDate: string | null | undefined },
  customer: { readingName: string | null | undefined; birthday: string | null | undefined },
): RequestCustomerMismatch[] {
  const result: RequestCustomerMismatch[] = [];
  const requestName = (request.name ?? "").trim();
  const customerName = (customer.readingName ?? "").trim();
  if (requestName && customerName && requestName !== customerName) result.push("name");
  const requestBirth = (request.birthDate ?? "").trim();
  const customerBirth = (customer.birthday ?? "").trim();
  if (requestBirth && customerBirth && requestBirth !== customerBirth) result.push("birthday");
  return result;
}

export const REQUEST_CUSTOMER_MISMATCH_LABELS: Record<RequestCustomerMismatch, string> = {
  name: "名前",
  birthday: "生年月日",
};
