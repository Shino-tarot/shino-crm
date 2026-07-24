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
}

export type CustomerFormValues = Omit<
  Customer,
  "id" | "customerNo" | "createdAt" | "updatedAt"
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
