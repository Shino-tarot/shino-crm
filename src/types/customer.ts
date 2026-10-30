export const GENDER_OPTIONS = ["女性", "男性", "その他", "未回答"] as const;

export interface Customer {
  id: string;
  customerNo: number;
  lineName: string;
  readingName: string;
  realName: string;
  lineUserId: string;
  age: string;
  gender: string;
  birthday: string;
  createdAt: string;
  updatedAt: string;
  // 非表示(論理削除)にした日時。null=表示中
  deletedAt: string | null;
  // 統合先の顧客id(統合された顧客のみ。統合された顧客は非表示のまま復元できない)
  mergedIntoCustomerId: string | null;
}

export type CustomerFormValues = Omit<
  Customer,
  "id" | "customerNo" | "createdAt" | "updatedAt" | "deletedAt" | "mergedIntoCustomerId"
>;

export const EMPTY_CUSTOMER_FORM_VALUES: CustomerFormValues = {
  lineName: "",
  readingName: "",
  realName: "",
  lineUserId: "",
  age: "",
  gender: "",
  birthday: "",
};
