import { CustomerRecord, CustomerRecordFormValues } from "@/types/customerRecord";
import { RecordCategory } from "@/lib/recordCategories";

export interface CustomerRecordRow {
  id: string;
  customer_id: string;
  category: string;
  record_date: string | null;
  title: string;
  content: string;
  amount: number | null;
  created_at: string;
  updated_at: string;
}

export function rowToCustomerRecord(row: CustomerRecordRow): CustomerRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    category: row.category as RecordCategory,
    date: row.record_date ?? "",
    title: row.title,
    content: row.content,
    amount: row.amount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function recordFormValuesToRow(values: CustomerRecordFormValues) {
  return {
    record_date: values.date === "" ? null : values.date,
    title: values.title,
    content: values.content,
    amount: values.amount,
  };
}
