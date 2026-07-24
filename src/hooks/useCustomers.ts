"use client";

import { useCallback, useEffect, useState } from "react";
import { Customer, CustomerFormValues } from "@/types/customer";
import {
  listCustomers,
  createCustomer,
  updateCustomer as updateCustomerAction,
  deleteCustomer as deleteCustomerAction,
} from "@/lib/customers/actions";

type Listener = () => void;

let cachedCustomers: Customer[] | null = null;
let inFlightLoad: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

function ensureLoaded() {
  if (cachedCustomers !== null || inFlightLoad) return;
  inFlightLoad = listCustomers()
    .then((customers) => {
      cachedCustomers = customers;
      notify();
    })
    .finally(() => {
      inFlightLoad = null;
    });
}

export function useCustomers() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    ensureLoaded();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addCustomer = useCallback(
    async (values: CustomerFormValues): Promise<string> => {
      const created = await createCustomer(values);
      cachedCustomers = [created, ...(cachedCustomers ?? [])];
      notify();
      return created.id;
    },
    [],
  );

  const updateCustomer = useCallback(
    async (id: string, values: CustomerFormValues) => {
      const updated = await updateCustomerAction(id, values);
      cachedCustomers = (cachedCustomers ?? []).map((customer) =>
        customer.id === id ? updated : customer,
      );
      notify();
    },
    [],
  );

  const deleteCustomer = useCallback(async (id: string) => {
    await deleteCustomerAction(id);
    cachedCustomers = (cachedCustomers ?? []).filter(
      (customer) => customer.id !== id,
    );
    notify();
  }, []);

  return {
    customers: cachedCustomers ?? [],
    isLoaded: cachedCustomers !== null,
    addCustomer,
    updateCustomer,
    deleteCustomer,
  };
}
