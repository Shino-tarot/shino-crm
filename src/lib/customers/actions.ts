"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { Customer, CustomerFormValues } from "@/types/customer";
import {
  CustomerRow,
  customerFormValuesToRow,
  rowToCustomer,
} from "@/lib/customers/mapper";

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await supabaseServerClient
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CustomerRow[]).map(rowToCustomer);
}

export async function createCustomer(
  values: CustomerFormValues,
): Promise<Customer> {
  const { data, error } = await supabaseServerClient
    .from("customers")
    .insert(customerFormValuesToRow(values))
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToCustomer(data as CustomerRow);
}

export async function updateCustomer(
  id: string,
  values: CustomerFormValues,
): Promise<Customer> {
  const { data, error } = await supabaseServerClient
    .from("customers")
    .update(customerFormValuesToRow(values))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToCustomer(data as CustomerRow);
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabaseServerClient
    .from("customers")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
