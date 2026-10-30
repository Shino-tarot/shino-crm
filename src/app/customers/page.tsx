"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerCreateModal } from "@/components/customers/CustomerCreateModal";
import { CustomerTable } from "@/components/customers/CustomerTable";
import { SearchBar } from "@/components/customers/SearchBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCustomers } from "@/hooks/useCustomers";
import {
  CustomerListView,
  filterCustomersByView,
  searchCustomers,
} from "@/lib/customers/visibility";
import { Customer, CustomerFormValues } from "@/types/customer";
import { useAccountId } from "@/components/accounts/AccountProvider";
import { listCustomerOverviews } from "@/lib/customers/overview";
import { CustomerOverview } from "@/lib/customers/overviewRules";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";

// ステータスの絞り込み(最新の無料鑑定申込のステータス)。"none" は申込のない顧客
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "すべてのステータス" },
  ...Object.entries(STATUS_LABELS).map(([value, info]) => ({ value, label: info.label })),
  { value: "none", label: "申込なし" },
];

// 顧客の削除は行わず、非表示(論理削除)・復元のみ行う。非表示にしても関連データは残る
interface VisibilityTarget {
  customer: Customer;
  action: "hide" | "restore";
}

export default function CustomersPage() {
  const router = useRouter();
  const accountId = useAccountId();
  const { customers, isLoaded, addCustomer, hideCustomer, restoreCustomer } =
    useCustomers();
  // 最新ステータス・最終申込日・LINE連携(申込・LINE送信者から集計。読み込みに失敗しても一覧は表示する)
  const [overviews, setOverviews] = useState<Record<string, CustomerOverview> | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    listCustomerOverviews(accountId)
      .then((result) => {
        if (!cancelled) setOverviews(result);
      })
      .catch(() => {
        if (!cancelled) setOverviews({});
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, customers.length]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<CustomerListView>("active");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [target, setTarget] = useState<VisibilityTarget | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );

  const viewCustomers = useMemo(
    () => filterCustomersByView(customers, view),
    [customers, view],
  );
  const hiddenCount = useMemo(
    () => filterCustomersByView(customers, "hidden").length,
    [customers],
  );
  const filteredCustomers = useMemo(() => {
    const searched = searchCustomers(viewCustomers, searchQuery);
    if (!statusFilter || !overviews) return searched;
    return searched.filter((customer) => {
      const status = overviews[customer.id]?.latestStatus ?? null;
      return statusFilter === "none" ? status === null : status === statusFilter;
    });
  }, [viewCustomers, searchQuery, statusFilter, overviews]);

  async function handleCreate(values: CustomerFormValues) {
    const id = await addCustomer(values);
    setIsFormOpen(false);
    router.push(`/customers/${id}`);
  }

  function openConfirm(customer: Customer, action: VisibilityTarget["action"]) {
    setMessage(null);
    setTarget({ customer, action });
  }

  async function handleConfirm() {
    // 処理中の二重実行を防ぐ(確認ボタンも処理中は無効化している)
    if (!target || isProcessing) return;
    setIsProcessing(true);
    try {
      const result =
        target.action === "hide"
          ? await hideCustomer(target.customer.id)
          : await restoreCustomer(target.customer.id);
      setMessage(
        result.ok
          ? {
              tone: "success",
              text:
                target.action === "hide"
                  ? `「${target.customer.readingName}」を非表示にしました。「非表示の顧客」から復元できます。`
                  : `「${target.customer.readingName}」を復元しました。`,
            }
          : { tone: "error", text: result.error },
      );
    } catch {
      setMessage({ tone: "error", text: "処理に失敗しました。時間をおいて再度お試しください。" });
    } finally {
      setIsProcessing(false);
      setTarget(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">顧客管理</h1>
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          + 新規登録
        </button>
      </div>

      <nav className="mb-4 flex gap-2 border-b border-zinc-200">
        {(
          [
            { key: "active", label: "表示中の顧客" },
            { key: "hidden", label: `非表示の顧客（${hiddenCount}）` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setView(tab.key);
              setMessage(null);
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              view === tab.key
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {message && (
        <p
          className={`mb-4 rounded-md px-4 py-3 text-sm font-medium ${
            message.tone === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="ステータスで絞り込み"
            className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-700"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="whitespace-nowrap text-sm text-zinc-500">
          {filteredCustomers.length}件 / 全{viewCustomers.length}件
        </p>
      </div>

      {isLoaded ? (
        <CustomerTable
          customers={filteredCustomers}
          overviews={overviews}
          view={view}
          onHide={(customer) => openConfirm(customer, "hide")}
          onRestore={(customer) => openConfirm(customer, "restore")}
        />
      ) : (
        <div className="py-16 text-center text-sm text-zinc-400">
          読み込み中...
        </div>
      )}

      {isFormOpen && (
        <CustomerCreateModal
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {target && (
        <ConfirmDialog
          title={target.action === "hide" ? "顧客の非表示" : "顧客の復元"}
          message={
            target.action === "hide" ? (
              <>
                「{target.customer.readingName}」を非表示にします。
                <br />
                無料鑑定申込・購入履歴・会話履歴・LINE紐づけは削除されず、そのまま残ります。「非表示の顧客」からいつでも復元できます。よろしいですか？
              </>
            ) : (
              <>
                「{target.customer.readingName}」を復元し、通常の顧客一覧に戻します。よろしいですか？
              </>
            )
          }
          confirmLabel={target.action === "hide" ? "非表示にする" : "復元する"}
          confirmingLabel="処理中..."
          isConfirming={isProcessing}
          onCancel={() => {
            if (!isProcessing) setTarget(null);
          }}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
