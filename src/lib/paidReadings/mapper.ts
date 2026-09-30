import { PaidReading } from "@/types/paidReading";

export interface PaidReadingRow {
  id: string;
  customer_id: string;
  purchase_date: string;
  product_name: string;
  amount: number;
  payment_method: string | null;
  hearing_content: string | null;
  reading_content: string | null;
  sent_at: string | null;
  memo: string;
  created_at: string;
  updated_at: string;
}

export function rowToPaidReading(row: PaidReadingRow): PaidReading {
  return {
    id: row.id,
    customerId: row.customer_id,
    purchaseDate: row.purchase_date,
    productName: row.product_name,
    amount: row.amount,
    paymentMethod: row.payment_method ?? "",
    hearingContent: row.hearing_content ?? "",
    readingContent: row.reading_content ?? "",
    sentAt: row.sent_at ?? "",
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface NormalizedPaidReading {
  purchaseDate: string;
  productName: string;
  amount: number;
  paymentMethod: string | null;
  hearingContent: string | null;
  readingContent: string | null;
  sentAt: string | null;
  memo: string;
}

export function paidReadingToRow(data: NormalizedPaidReading) {
  return {
    purchase_date: data.purchaseDate,
    product_name: data.productName,
    amount: data.amount,
    payment_method: data.paymentMethod,
    hearing_content: data.hearingContent,
    reading_content: data.readingContent,
    sent_at: data.sentAt,
    memo: data.memo,
  };
}
