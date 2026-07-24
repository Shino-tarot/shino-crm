"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { CustomerRecord, CustomerRecordFormValues } from "@/types/customerRecord";
import { RecordCategory } from "@/lib/recordCategories";
import {
  CustomerRecordRow,
  recordFormValuesToRow,
  rowToCustomerRecord,
} from "@/lib/customerRecords/mapper";

export async function listCustomerRecords(
  customerId: string,
): Promise<CustomerRecord[]> {
  const { data, error } = await supabaseServerClient
    .from("customer_records")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CustomerRecordRow[]).map(rowToCustomerRecord);
}

export async function createCustomerRecord(
  customerId: string,
  category: RecordCategory,
  values: CustomerRecordFormValues,
): Promise<CustomerRecord> {
  const { data, error } = await supabaseServerClient
    .from("customer_records")
    .insert({
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
  id: string,
  values: CustomerRecordFormValues,
): Promise<CustomerRecord> {
  const { data, error } = await supabaseServerClient
    .from("customer_records")
    .update(recordFormValuesToRow(values))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToCustomerRecord(data as CustomerRecordRow);
}

export async function deleteCustomerRecord(id: string): Promise<void> {
  const { error } = await supabaseServerClient
    .from("customer_records")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
