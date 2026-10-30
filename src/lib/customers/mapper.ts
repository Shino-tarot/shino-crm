import { Customer, CustomerFormValues } from "@/types/customer";

export interface CustomerRow {
  id: string;
  customer_no: number;
  line_name: string;
  reading_name: string;
  real_name: string;
  line_user_id: string;
  age: number | null;
  gender: string;
  birthday: string | null;
  created_at: string;
  updated_at: string;
  // 0013マイグレーション未適用のDBではundefinedになりうる
  deleted_at?: string | null;
  // 0015マイグレーション未適用のDBではundefinedになりうる
  merged_into_customer_id?: string | null;
}

export function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    customerNo: row.customer_no,
    lineName: row.line_name,
    readingName: row.reading_name,
    realName: row.real_name,
    lineUserId: row.line_user_id,
    age: row.age == null ? "" : String(row.age),
    gender: row.gender,
    birthday: row.birthday ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
    mergedIntoCustomerId: row.merged_into_customer_id ?? null,
  };
}

export function customerFormValuesToRow(values: CustomerFormValues) {
  return {
    line_name: values.lineName,
    reading_name: values.readingName,
    real_name: values.realName,
    line_user_id: values.lineUserId,
    age: values.age.trim() === "" ? null : Number(values.age),
    gender: values.gender,
    birthday: values.birthday === "" ? null : values.birthday,
  };
}
