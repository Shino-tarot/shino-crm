"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { PaidReading, PaidReadingFormValues } from "@/types/paidReading";
import { validatePaidReadingForm } from "@/lib/paidReadings/validation";
import {
  PaidReadingRow,
  paidReadingToRow,
  rowToPaidReading,
} from "@/lib/paidReadings/mapper";

export type SavePaidReadingResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

// 論理削除(deleted_at)済みの行は一覧・集計から除外する。
export async function listPaidReadings(
  customerId: string,
): Promise<PaidReading[]> {
  const { data, error } = await supabaseServerClient
    .from("paid_readings")
    .select("*")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as PaidReadingRow[]).map(rowToPaidReading);
}

export async function createPaidReading(
  customerId: string,
  values: PaidReadingFormValues,
): Promise<SavePaidReadingResult> {
  const result = validatePaidReadingForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  const { data, error } = await supabaseServerClient
    .from("paid_readings")
    .insert({ customer_id: customerId, ...paidReadingToRow(result.data) })
    .select("id")
    .single();

  if (error) {
    console.error("[paid-readings] insert failed:", error.message);
    return {
      ok: false,
      errors: { _form: "登録に失敗しました。時間をおいて再度お試しください。" },
    };
  }
  return { ok: true, id: data.id };
}

export async function updatePaidReading(
  id: string,
  values: PaidReadingFormValues,
): Promise<SavePaidReadingResult> {
  const result = validatePaidReadingForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  const { error } = await supabaseServerClient
    .from("paid_readings")
    .update(paidReadingToRow(result.data))
    .eq("id", id);

  if (error) {
    console.error("[paid-readings] update failed:", error.message);
    return {
      ok: false,
      errors: { _form: "更新に失敗しました。時間をおいて再度お試しください。" },
    };
  }
  return { ok: true, id };
}

// 物理削除ではなく論理削除(deleted_atをセット)する。
// 呼び出し元(UI)で必ず確認ダイアログを表示してから呼ぶこと。
export async function deletePaidReading(id: string): Promise<void> {
  const { error } = await supabaseServerClient
    .from("paid_readings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[paid-readings] delete failed:", error.message);
    throw new Error(error.message);
  }
}
