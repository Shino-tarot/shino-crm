"use client";

import { useCallback, useEffect, useState } from "react";
import { CustomerRecord, CustomerRecordFormValues } from "@/types/customerRecord";
import { RecordCategory } from "@/lib/recordCategories";
import {
  listCustomerRecords,
  createCustomerRecord,
  updateCustomerRecord as updateCustomerRecordAction,
  deleteCustomerRecord as deleteCustomerRecordAction,
} from "@/lib/customerRecords/actions";
import { AccountId } from "@/lib/accounts/accounts";
import { useAccountId } from "@/components/accounts/AccountProvider";

type Listener = () => void;

// アカウント+customerIdごとにレコード一覧をキャッシュする（顧客をまたいだ全件取得はしない）
const cache = new Map<string, CustomerRecord[]>();
const inFlight = new Map<string, Promise<void>>();
const listenersByCustomer = new Map<string, Set<Listener>>();

function notify(customerId: string) {
  listenersByCustomer.get(customerId)?.forEach((listener) => listener());
}

function cacheKey(accountId: AccountId, customerId: string): string {
  return `${accountId}:${customerId}`;
}

function ensureLoaded(accountId: AccountId, customerId: string) {
  const key = cacheKey(accountId, customerId);
  if (cache.has(key) || inFlight.has(key)) return;
  const promise = listCustomerRecords(accountId, customerId)
    .then((records) => {
      cache.set(key, records);
      notify(key);
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
}

export function useCustomerRecords(customerId: string) {
  const accountId = useAccountId();
  const key = cacheKey(accountId, customerId);
  const [, forceRender] = useState(0);

  useEffect(() => {
    let listeners = listenersByCustomer.get(key);
    if (!listeners) {
      listeners = new Set();
      listenersByCustomer.set(key, listeners);
    }
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    ensureLoaded(accountId, customerId);
    return () => {
      listeners!.delete(listener);
    };
  }, [accountId, customerId, key]);

  const records = cache.get(key) ?? [];
  const isLoaded = cache.has(key);

  const addRecord = useCallback(
    async (category: RecordCategory, values: CustomerRecordFormValues) => {
      const created = await createCustomerRecord(accountId, customerId, category, values);
      cache.set(key, [created, ...(cache.get(key) ?? [])]);
      notify(key);
    },
    [accountId, customerId, key],
  );

  const updateRecord = useCallback(
    async (id: string, values: CustomerRecordFormValues) => {
      const updated = await updateCustomerRecordAction(accountId, id, values);
      cache.set(
        key,
        (cache.get(key) ?? []).map((record) =>
          record.id === id ? updated : record,
        ),
      );
      notify(key);
    },
    [accountId, key],
  );

  const deleteRecord = useCallback(
    async (id: string) => {
      await deleteCustomerRecordAction(accountId, id);
      cache.set(
        key,
        (cache.get(key) ?? []).filter((record) => record.id !== id),
      );
      notify(key);
    },
    [accountId, key],
  );

  return { records, isLoaded, addRecord, updateRecord, deleteRecord };
}
