"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { requireStaffAccount } from "@/lib/accounts/current";
import { AccountId } from "@/lib/accounts/accounts";
import {
  CustomerOverview,
  OverviewRequestRow,
  summarizeCustomerOverviews,
} from "@/lib/customers/overviewRules";

// 顧客一覧用: 顧客ごとの最新ステータス・最終申込日・申込件数・LINE連携(選択中のアカウントのみ)
export async function listCustomerOverviews(
  accountId: AccountId,
): Promise<Record<string, CustomerOverview>> {
  await requireStaffAccount(accountId);
  const [requestsRes, contactsRes] = await Promise.all([
    supabaseServerClient
      .from("free_reading_requests")
      .select("customer_id, status, application_date, created_at")
      .eq("account_id", accountId)
      .not("customer_id", "is", null),
    supabaseServerClient
      .from("line_contacts")
      .select("customer_id")
      .eq("account_id", accountId)
      .not("customer_id", "is", null),
  ]);
  if (requestsRes.error || contactsRes.error) {
    // エラー内容には値が含まれうるため、ログにはエラーコードのみ出す
    console.error("[customer-overview] load failed:", requestsRes.error?.code ?? contactsRes.error?.code);
    throw new Error("CUSTOMER_OVERVIEW_LOAD_FAILED");
  }
  return summarizeCustomerOverviews(
    requestsRes.data as OverviewRequestRow[],
    (contactsRes.data as { customer_id: string }[]).map((row) => row.customer_id),
  );
}
