"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { requireStaffAccount } from "@/lib/accounts/current";
import { AccountId } from "@/lib/accounts/accounts";
import { isUuid } from "@/lib/conversationMessages/validation";
import {
  MERGED_CUSTOMER_RESTORE_MESSAGE,
  VISIBILITY_CONFLICT_MESSAGES,
} from "@/lib/customers/visibility";
import { Customer, CustomerFormValues } from "@/types/customer";
import {
  CustomerRow,
  customerFormValuesToRow,
  rowToCustomer,
} from "@/lib/customers/mapper";

// 全ての関数の第1引数は「画面を表示したときのアカウント」。requireStaffAccount で選択中のアカウントと照合し、
// 読み書きはそのアカウントの顧客だけに限定する(別アカウントの顧客IDを指定されても0件になる)。

// 非表示の顧客も含めて返す(一覧の「非表示の顧客」表示・非表示中の顧客詳細のため)。
// 表示中/非表示の振り分けは呼び出し側(filterCustomersByView)で行う
export async function listCustomers(accountId: AccountId): Promise<Customer[]> {
  await requireStaffAccount(accountId);
  const { data, error } = await supabaseServerClient
    .from("customers")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CustomerRow[]).map(rowToCustomer);
}

// 1件取得(選択中のアカウントの顧客のみ。非表示の顧客も返す)
export async function getCustomer(accountId: AccountId, id: string): Promise<Customer | null> {
  await requireStaffAccount(accountId);
  const { data, error } = await supabaseServerClient
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToCustomer(data as CustomerRow) : null;
}

export async function createCustomer(
  accountId: AccountId,
  values: CustomerFormValues,
): Promise<Customer> {
  await requireStaffAccount(accountId);
  const { data, error } = await supabaseServerClient
    .from("customers")
    .insert({ ...customerFormValuesToRow(values), account_id: accountId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToCustomer(data as CustomerRow);
}

export async function updateCustomer(
  accountId: AccountId,
  id: string,
  values: CustomerFormValues,
): Promise<Customer> {
  await requireStaffAccount(accountId);
  const { data, error } = await supabaseServerClient
    .from("customers")
    .update(customerFormValuesToRow(values))
    .eq("id", id)
    .eq("account_id", accountId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToCustomer(data as CustomerRow);
}

// 顧客の物理削除(delete)は行わない。削除の代わりに非表示(deleted_atをセット)にする。
// 物理削除すると外部キーの設定により有料鑑定・アップセル・記録・手動の会話履歴が連動して消え、
// 申込・LINE送信者の紐づけが外れるため(0013_customers_soft_delete.sql参照)。
// 非表示・復元は customers の deleted_at / deleted_by だけを更新し、関連テーブルには触れない。

export type CustomerVisibilityResult =
  | { ok: true; customer: Customer }
  | { ok: false; error: string };

// 表示中の顧客のみ非表示にする(既に非表示なら0件になり、二重操作として扱う)
export async function hideCustomer(
  accountId: AccountId,
  id: string,
): Promise<CustomerVisibilityResult> {
  const { staff } = await requireStaffAccount(accountId);
  if (!isUuid(id)) return { ok: false, error: "顧客が正しく指定されていません。" };

  const { data, error } = await supabaseServerClient
    .from("customers")
    .update({ deleted_at: new Date().toISOString(), deleted_by: staff.id })
    .eq("id", id)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .select("*");
  if (error) {
    // エラー内容には値が含まれうるため、ログにはエラーコードのみ出す
    console.error("[customers] hide failed:", error.code);
    return { ok: false, error: "非表示にできませんでした。時間をおいて再度お試しください。" };
  }
  if (!data?.length) return { ok: false, error: VISIBILITY_CONFLICT_MESSAGES.hide };
  return { ok: true, customer: rowToCustomer(data[0] as CustomerRow) };
}

// CHECK制約違反(統合された顧客は非表示のまま: 0015_customer_merge_function.sql)
const CHECK_VIOLATION = "23514";

// 非表示の顧客のみ復元する(既に表示中なら0件になり、二重操作として扱う)。
// 統合された顧客はDBのCHECK制約で復元が拒否される
export async function restoreCustomer(
  accountId: AccountId,
  id: string,
): Promise<CustomerVisibilityResult> {
  await requireStaffAccount(accountId);
  if (!isUuid(id)) return { ok: false, error: "顧客が正しく指定されていません。" };

  const { data, error } = await supabaseServerClient
    .from("customers")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .eq("account_id", accountId)
    .not("deleted_at", "is", null)
    .select("*");
  if (error?.code === CHECK_VIOLATION) {
    return { ok: false, error: MERGED_CUSTOMER_RESTORE_MESSAGE };
  }
  if (error) {
    console.error("[customers] restore failed:", error.code);
    return { ok: false, error: "復元できませんでした。時間をおいて再度お試しください。" };
  }
  if (!data?.length) return { ok: false, error: VISIBILITY_CONFLICT_MESSAGES.restore };
  return { ok: true, customer: rowToCustomer(data[0] as CustomerRow) };
}
