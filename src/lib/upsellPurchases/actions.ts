"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { UpsellPurchase, UpsellPurchaseFormValues } from "@/types/upsellPurchase";
import { validateUpsellPurchaseForm } from "@/lib/upsellPurchases/validation";
import {
  UpsellPurchaseRow,
  upsellPurchaseToRow,
  rowToUpsellPurchase,
} from "@/lib/upsellPurchases/mapper";

export type SaveUpsellPurchaseResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

export async function listUpsellPurchases(
  customerId: string,
): Promise<UpsellPurchase[]> {
  const { data, error } = await supabaseServerClient
    .from("upsell_purchases")
    .select("*")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as UpsellPurchaseRow[]).map(rowToUpsellPurchase);
}

export async function createUpsellPurchase(
  customerId: string,
  values: UpsellPurchaseFormValues,
): Promise<SaveUpsellPurchaseResult> {
  const result = validateUpsellPurchaseForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  const { data, error } = await supabaseServerClient
    .from("upsell_purchases")
    .insert({ customer_id: customerId, ...upsellPurchaseToRow(result.data) })
    .select("id")
    .single();

  if (error) {
    console.error("[upsell-purchases] insert failed:", error.message);
    return {
      ok: false,
      errors: { _form: "登録に失敗しました。時間をおいて再度お試しください。" },
    };
  }
  return { ok: true, id: data.id };
}

export async function updateUpsellPurchase(
  id: string,
  values: UpsellPurchaseFormValues,
): Promise<SaveUpsellPurchaseResult> {
  const result = validateUpsellPurchaseForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  const { error } = await supabaseServerClient
    .from("upsell_purchases")
    .update(upsellPurchaseToRow(result.data))
    .eq("id", id);

  if (error) {
    console.error("[upsell-purchases] update failed:", error.message);
    return {
      ok: false,
      errors: { _form: "更新に失敗しました。時間をおいて再度お試しください。" },
    };
  }
  return { ok: true, id };
}

// 物理削除ではなく論理削除(deleted_atをセット)する。
// 呼び出し元(UI)で必ず確認ダイアログを表示してから呼ぶこと。
export async function deleteUpsellPurchase(id: string): Promise<void> {
  const { error } = await supabaseServerClient
    .from("upsell_purchases")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[upsell-purchases] delete failed:", error.message);
    throw new Error(error.message);
  }
}
