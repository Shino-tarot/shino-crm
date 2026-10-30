"use client";

import { useCallback, useEffect, useState } from "react";
import { Customer, CustomerFormValues } from "@/types/customer";
import {
  listCustomers,
  createCustomer,
  updateCustomer as updateCustomerAction,
  hideCustomer as hideCustomerAction,
  restoreCustomer as restoreCustomerAction,
  CustomerVisibilityResult,
} from "@/lib/customers/actions";
import { AccountId } from "@/lib/accounts/accounts";
import { useAccountId } from "@/components/accounts/AccountProvider";

type Listener = () => void;

// 顧客一覧のキャッシュ。アカウントを切り替えたら別のアカウントの一覧を使い回さない(cachedAccountIdで区別する)
let cachedAccountId: AccountId | null = null;
let cachedCustomers: Customer[] | null = null;
let inFlightLoad: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

function ensureLoaded(accountId: AccountId) {
  if (cachedAccountId !== accountId) {
    cachedAccountId = accountId;
    cachedCustomers = null;
    inFlightLoad = null;
  }
  if (cachedCustomers !== null || inFlightLoad) return;
  const load = listCustomers(accountId)
    .then((customers) => {
      // 読み込み中にアカウントが変わった場合は結果を捨てる
      if (cachedAccountId !== accountId) return;
      cachedCustomers = customers;
      notify();
    })
    .finally(() => {
      if (inFlightLoad === load) inFlightLoad = null;
    });
  inFlightLoad = load;
}

export function useCustomers() {
  const accountId = useAccountId();
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    ensureLoaded(accountId);
    return () => {
      listeners.delete(listener);
    };
  }, [accountId]);

  const addCustomer = useCallback(
    async (values: CustomerFormValues): Promise<string> => {
      const created = await createCustomer(accountId, values);
      cachedCustomers = [created, ...(cachedCustomers ?? [])];
      notify();
      return created.id;
    },
    [accountId],
  );

  const updateCustomer = useCallback(
    async (id: string, values: CustomerFormValues) => {
      const updated = await updateCustomerAction(accountId, id, values);
      cachedCustomers = (cachedCustomers ?? []).map((customer) =>
        customer.id === id ? updated : customer,
      );
      notify();
    },
    [accountId],
  );

  // 非表示・復元はキャッシュ内の顧客を最新の行で置き換えるだけ(一覧から取り除かない)
  const applyVisibilityResult = useCallback(
    (result: CustomerVisibilityResult): CustomerVisibilityResult => {
      if (result.ok) {
        cachedCustomers = (cachedCustomers ?? []).map((customer) =>
          customer.id === result.customer.id ? result.customer : customer,
        );
        notify();
      }
      return result;
    },
    [],
  );

  const hideCustomer = useCallback(
    async (id: string) => applyVisibilityResult(await hideCustomerAction(accountId, id)),
    [accountId, applyVisibilityResult],
  );

  const restoreCustomer = useCallback(
    async (id: string) => applyVisibilityResult(await restoreCustomerAction(accountId, id)),
    [accountId, applyVisibilityResult],
  );

  const isCurrentAccount = cachedAccountId === accountId;
  return {
    customers: isCurrentAccount ? (cachedCustomers ?? []) : [],
    isLoaded: isCurrentAccount && cachedCustomers !== null,
    addCustomer,
    updateCustomer,
    hideCustomer,
    restoreCustomer,
  };
}
