"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { insertCustomer } from "@/lib/customers/createCustomer";
import { requireStaff } from "@/lib/auth/requireStaff";

// 新規申込時の顧客自動作成(insertCustomer)は、公開フォームからも使うため
// Server ActionではないcreateCustomer.tsへ移した(このファイルからexportすると外部から直接呼べてしまうため)。

// 既存(まだcustomer_idが未設定)の無料鑑定申込を、スタッフの操作で顧客登録する。
// すでに顧客登録済みの場合は何もせず、その顧客IDをそのまま返す(冪等)。
export async function registerCustomerForRequest(
  requestId: string,
): Promise<string> {
  await requireStaff();
  const { data: request, error: fetchError } = await supabaseServerClient
    .from("free_reading_requests")
    .select("id, customer_id, line_name, reading_name, birth_date, gender, age")
    .eq("id", requestId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (request.customer_id) return request.customer_id as string;

  const customerId = await insertCustomer({
    lineName: request.line_name ?? "",
    readingName: request.reading_name ?? "",
    birthDate: request.birth_date,
    gender: request.gender,
    age: request.age,
  });

  const { error: updateError } = await supabaseServerClient
    .from("free_reading_requests")
    .update({ customer_id: customerId })
    .eq("id", requestId);
  if (updateError) throw new Error(updateError.message);

  return customerId;
}

// 「同じ顧客として紐付ける」操作(スタッフの明示的な確認ダイアログ経由でのみ呼ばれる想定)。
// currentRequestIdがまだ顧客未登録なら先に顧客登録してから紐付ける。
// targetRequestIdがすでに別のcustomerに属していた場合は、そのcustomerに紐づく
// 全レコード(無料鑑定・有料鑑定・アップセル)をcurrentの顧客へ付け替える(データは削除しない)。
// LINE表示名等による自動判定・自動統合は行わない(必ずスタッフの明示操作からのみ実行される)。
export async function linkRequestsAsSameCustomer(
  currentRequestId: string,
  targetRequestId: string,
): Promise<string> {
  await requireStaff();
  const currentCustomerId = await registerCustomerForRequest(currentRequestId);

  const { data: target, error: targetError } = await supabaseServerClient
    .from("free_reading_requests")
    .select("id, customer_id")
    .eq("id", targetRequestId)
    .single();
  if (targetError) throw new Error(targetError.message);

  const targetCustomerId = target.customer_id as string | null;

  if (targetCustomerId === currentCustomerId) {
    return currentCustomerId;
  }

  if (!targetCustomerId) {
    const { error } = await supabaseServerClient
      .from("free_reading_requests")
      .update({ customer_id: currentCustomerId })
      .eq("id", targetRequestId);
    if (error) throw new Error(error.message);
    return currentCustomerId;
  }

  const reassignments = await Promise.all([
    supabaseServerClient
      .from("free_reading_requests")
      .update({ customer_id: currentCustomerId })
      .eq("customer_id", targetCustomerId),
    supabaseServerClient
      .from("paid_readings")
      .update({ customer_id: currentCustomerId })
      .eq("customer_id", targetCustomerId),
    supabaseServerClient
      .from("upsell_purchases")
      .update({ customer_id: currentCustomerId })
      .eq("customer_id", targetCustomerId),
  ]);
  for (const result of reassignments) {
    if (result.error) throw new Error(result.error.message);
  }

  return currentCustomerId;
}
