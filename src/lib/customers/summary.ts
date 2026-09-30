"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { CustomerSummary } from "@/types/customerSummary";

// サマリー4項目(無料鑑定回数・有料鑑定回数・アップセル回数・累計購入額)は
// 手入力・別カラムでの保持はせず、都度related テーブルから集計する。
// 累計購入額 = paid_readings.amount合計 + upsell_purchases.amount合計(無料鑑定は0円扱い)。
// 論理削除(deleted_at)済みの購入・鑑定は集計対象から除外する。
export async function getCustomerSummary(
  customerId: string,
): Promise<CustomerSummary> {
  const [freeReadingRes, paidReadingsRes, upsellRes] = await Promise.all([
    supabaseServerClient
      .from("free_reading_requests")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId),
    supabaseServerClient
      .from("paid_readings")
      .select("amount")
      .eq("customer_id", customerId)
      .is("deleted_at", null),
    supabaseServerClient
      .from("upsell_purchases")
      .select("amount")
      .eq("customer_id", customerId)
      .is("deleted_at", null),
  ]);

  if (freeReadingRes.error) throw new Error(freeReadingRes.error.message);
  if (paidReadingsRes.error) throw new Error(paidReadingsRes.error.message);
  if (upsellRes.error) throw new Error(upsellRes.error.message);

  const paidReadingRows = (paidReadingsRes.data ?? []) as { amount: number }[];
  const upsellRows = (upsellRes.data ?? []) as { amount: number }[];

  const paidTotal = paidReadingRows.reduce((sum, row) => sum + row.amount, 0);
  const upsellTotal = upsellRows.reduce((sum, row) => sum + row.amount, 0);

  return {
    freeReadingCount: freeReadingRes.count ?? 0,
    paidReadingCount: paidReadingRows.length,
    upsellCount: upsellRows.length,
    totalAmount: paidTotal + upsellTotal,
  };
}
