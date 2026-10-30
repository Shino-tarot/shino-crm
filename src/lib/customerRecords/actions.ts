"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { isCustomerInAccount, requireStaffAccount } from "@/lib/accounts/current";
import { AccountId } from "@/lib/accounts/accounts";
import { CustomerRecord, CustomerRecordFormValues } from "@/types/customerRecord";
import { RecordCategory } from "@/lib/recordCategories";
import {
  CustomerRecordRow,
  recordFormValuesToRow,
  rowToCustomerRecord,
} from "@/lib/customerRecords/mapper";

// 全ての関数の第1引数は「画面を表示したときのアカウント」。そのアカウントの記録だけを読み書きする
export async function listCustomerRecords(
  accountId: AccountId,
  customerId: string,
): Promise<CustomerRecord[]> {
  await requireStaffAccount(accountId);
  const { data, error } = await supabaseServerClient
    .from("customer_records")
    .select("*")
    .eq("customer_id", customerId)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CustomerRecordRow[]).map(rowToCustomerRecord);
}

export async function createCustomerRecord(
  accountId: AccountId,
  customerId: string,
  category: RecordCategory,
  values: CustomerRecordFormValues,
): Promise<CustomerRecord> {
  await requireStaffAccount(accountId);
  if (!(await isCustomerInAccount(accountId, customerId))) throw new Error("CUSTOMER_NOT_FOUND");
  const { data, error } = await supabaseServerClient
    .from("customer_records")
    .insert({
      account_id: accountId,
      customer_id: customerId,
      category,
      ...recordFormValuesToRow(values),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToCustomerRecord(data as CustomerRecordRow);
}

export async function updateCustomerRecord(
  accountId: AccountId,
  id: string,
  values: CustomerRecordFormValues,
): Promise<CustomerRecord> {
  await requireStaffAccount(accountId);
  const { data, error } = await supabaseServerClient
    .from("customer_records")
    .update(recordFormValuesToRow(values))
    .eq("id", id)
    .eq("account_id", accountId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToCustomerRecord(data as CustomerRecordRow);
}

export async function deleteCustomerRecord(accountId: AccountId, id: string): Promise<void> {
  await requireStaffAccount(accountId);
  const { error } = await supabaseServerClient
    .from("customer_records")
    .delete()
    .eq("id", id)
    .eq("account_id", accountId);
  if (error) throw new Error(error.message);
}
