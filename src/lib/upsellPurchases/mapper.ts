import { UpsellPurchase } from "@/types/upsellPurchase";

export interface UpsellPurchaseRow {
  id: string;
  customer_id: string;
  purchase_date: string;
  product_name: string;
  product_type: string | null;
  amount: number;
  memo: string;
  created_at: string;
  updated_at: string;
}

export function rowToUpsellPurchase(row: UpsellPurchaseRow): UpsellPurchase {
  return {
    id: row.id,
    customerId: row.customer_id,
    purchaseDate: row.purchase_date,
    productName: row.product_name,
    productType: row.product_type ?? "",
    amount: row.amount,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface NormalizedUpsellPurchase {
  purchaseDate: string;
  productName: string;
  productType: string | null;
  amount: number;
  memo: string;
}

export function upsellPurchaseToRow(data: NormalizedUpsellPurchase) {
  return {
    purchase_date: data.purchaseDate,
    product_name: data.productName,
    product_type: data.productType,
    amount: data.amount,
    memo: data.memo,
  };
}
