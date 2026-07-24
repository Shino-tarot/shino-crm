import { RecordCategory } from "@/lib/recordCategories";

export interface CustomerRecord {
  id: string;
  customerId: string;
  category: RecordCategory;
  date: string;
  title: string;
  content: string;
  amount: number | null;
  createdAt: string;
  updatedAt: string;
}

export type CustomerRecordFormValues = Omit<
  CustomerRecord,
  "id" | "customerId" | "category" | "createdAt" | "updatedAt"
>;

export const EMPTY_RECORD_FORM_VALUES: CustomerRecordFormValues = {
  date: "",
  title: "",
  content: "",
  amount: null,
};
