// 顧客の非表示(論理削除)・復元に関する判定(DBに依存しない純粋な関数のみ。単体テストの対象)。
// 非表示 = customers.deleted_at に日時が入っている状態(0013_customers_soft_delete.sql)。
// 非表示にしても顧客の行は削除しないため、申込・購入履歴・会話履歴・LINE紐づけはそのまま残る。

export type CustomerListView = "active" | "hidden";

export function isCustomerHidden(customer: { deletedAt: string | null }): boolean {
  return customer.deletedAt !== null;
}

// 一覧の表示切り替え(通常=表示中のみ / 「非表示の顧客」=非表示のみ)
export function filterCustomersByView<T extends { deletedAt: string | null }>(
  customers: T[],
  view: CustomerListView,
): T[] {
  return customers.filter((customer) =>
    view === "hidden" ? isCustomerHidden(customer) : !isCustomerHidden(customer),
  );
}

// 顧客一覧の検索(鑑定名・LINE表示名・本名の部分一致、大文字小文字は区別しない)
export function searchCustomers<
  T extends { lineName: string; readingName: string; realName: string },
>(customers: T[], rawQuery: string): T[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return customers;
  return customers.filter((customer) =>
    [customer.lineName, customer.readingName, customer.realName]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

export type CustomerVisibilityAction = "hide" | "restore";

// 条件付き更新(非表示は表示中の行だけ、復元は非表示の行だけ)が0件だった場合のメッセージ。
// 別の画面・二重クリックで先に操作されていた場合に、同じ操作を重ねて行わないようにする
export const VISIBILITY_CONFLICT_MESSAGES: Record<CustomerVisibilityAction, string> = {
  hide: "この顧客は既に非表示になっているか、見つかりません。画面を再読み込みしてください。",
  restore: "この顧客は既に復元されているか、見つかりません。画面を再読み込みしてください。",
};

export const MERGED_CUSTOMER_RESTORE_MESSAGE =
  "この顧客は別の顧客に統合済みのため復元できません。統合先の顧客をご確認ください。";

// 統合された顧客(統合先が記録されている顧客)は復元できない
export function canRestoreCustomer(customer: {
  deletedAt: string | null;
  mergedIntoCustomerId: string | null;
}): boolean {
  return customer.deletedAt !== null && customer.mergedIntoCustomerId === null;
}

// 「同じ顧客として紐付ける」の統合元・統合先に非表示の顧客が含まれる場合は統合しない
// (非表示の顧客へデータを集めたり、非表示の顧客のデータを気づかないまま移したりしないため)
export function canMergeCustomers(
  customers: { id: string; deletedAt: string | null }[],
): boolean {
  return customers.every((customer) => !isCustomerHidden(customer));
}
