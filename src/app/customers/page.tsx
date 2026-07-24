"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerCreateModal } from "@/components/customers/CustomerCreateModal";
import { CustomerTable } from "@/components/customers/CustomerTable";
import { SearchBar } from "@/components/customers/SearchBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCustomers } from "@/hooks/useCustomers";
import { Customer, CustomerFormValues } from "@/types/customer";

export default function CustomersPage() {
  const router = useRouter();
  const { customers, isLoaded, addCustomer, deleteCustomer } = useCustomers();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(
    null,
  );

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) =>
      [customer.lineName, customer.readingName, customer.realName]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [customers, searchQuery]);

  async function handleCreate(values: CustomerFormValues) {
    const id = await addCustomer(values);
    setIsFormOpen(false);
    router.push(`/customers/${id}`);
  }

  async function handleConfirmDelete() {
    if (!deletingCustomer) return;
    try {
      await deleteCustomer(deletingCustomer.id);
      setDeletingCustomer(null);
    } catch {
      window.alert("削除に失敗しました。時間をおいて再度お試しください。");
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

      <div className="mb-4 flex items-center justify-between gap-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <p className="whitespace-nowrap text-sm text-zinc-500">
          {filteredCustomers.length}件 / 全{customers.length}件
        </p>
      </div>

      {isLoaded ? (
        <CustomerTable
          customers={filteredCustomers}
          onDelete={setDeletingCustomer}
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

      {deletingCustomer && (
        <ConfirmDialog
          title="顧客の削除"
          message={`「${deletingCustomer.readingName}」を削除します。関連する記録もすべて削除され、この操作は取り消せません。よろしいですか？`}
          confirmLabel="削除する"
          onCancel={() => setDeletingCustomer(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
