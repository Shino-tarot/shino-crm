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

type Listener = () => void;

// customerIdごとにレコード一覧をキャッシュする（顧客をまたいだ全件取得はしない）
const cache = new Map<string, CustomerRecord[]>();
const inFlight = new Map<string, Promise<void>>();
const listenersByCustomer = new Map<string, Set<Listener>>();

function notify(customerId: string) {
  listenersByCustomer.get(customerId)?.forEach((listener) => listener());
}

function ensureLoaded(customerId: string) {
  if (cache.has(customerId) || inFlight.has(customerId)) return;
  const promise = listCustomerRecords(customerId)
    .then((records) => {
      cache.set(customerId, records);
      notify(customerId);
    })
    .finally(() => {
      inFlight.delete(customerId);
    });
  inFlight.set(customerId, promise);
}

export function useCustomerRecords(customerId: string) {
  const [, forceRender] = useState(0);

  useEffect(() => {
    let listeners = listenersByCustomer.get(customerId);
    if (!listeners) {
      listeners = new Set();
      listenersByCustomer.set(customerId, listeners);
    }
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    ensureLoaded(customerId);
    return () => {
      listeners!.delete(listener);
    };
  }, [customerId]);

  const records = cache.get(customerId) ?? [];
  const isLoaded = cache.has(customerId);

  const addRecord = useCallback(
    async (category: RecordCategory, values: CustomerRecordFormValues) => {
      const created = await createCustomerRecord(customerId, category, values);
      cache.set(customerId, [created, ...(cache.get(customerId) ?? [])]);
      notify(customerId);
    },
    [customerId],
  );

  const updateRecord = useCallback(
    async (id: string, values: CustomerRecordFormValues) => {
      const updated = await updateCustomerRecordAction(id, values);
      cache.set(
        customerId,
        (cache.get(customerId) ?? []).map((record) =>
          record.id === id ? updated : record,
        ),
      );
      notify(customerId);
    },
    [customerId],
  );

  const deleteRecord = useCallback(
    async (id: string) => {
      await deleteCustomerRecordAction(id);
      cache.set(
        customerId,
        (cache.get(customerId) ?? []).filter((record) => record.id !== id),
      );
      notify(customerId);
    },
    [customerId],
  );

  return { records, isLoaded, addRecord, updateRecord, deleteRecord };
}
