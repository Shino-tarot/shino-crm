"use client";

import { useState } from "react";
import { RecordFormModal } from "@/components/customers/RecordFormModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCustomerRecords } from "@/hooks/useCustomerRecords";
import { formatCurrency, formatDate } from "@/lib/format";
import { RecordCategoryConfig } from "@/lib/recordCategories";
import { CustomerRecord, CustomerRecordFormValues } from "@/types/customerRecord";

interface RecordListTabProps {
  customerId: string;
  config: RecordCategoryConfig;
}

export function RecordListTab({ customerId, config }: RecordListTabProps) {
  const { records, isLoaded, addRecord, updateRecord, deleteRecord } =
    useCustomerRecords(customerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CustomerRecord | null>(
    null,
  );
  const [deletingRecord, setDeletingRecord] = useState<CustomerRecord | null>(
    null,
  );

  function openCreateForm() {
    setEditingRecord(null);
    setIsFormOpen(true);
  }

  function openEditForm(record: CustomerRecord) {
    setEditingRecord(record);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingRecord(null);
  }

  async function handleSubmit(values: CustomerRecordFormValues) {
    if (editingRecord) {
      await updateRecord(editingRecord.id, values);
    } else {
      await addRecord(config.key, values);
    }
    closeForm();
  }

  async function handleConfirmDelete() {
    if (!deletingRecord) return;
    try {
      await deleteRecord(deletingRecord.id);
      setDeletingRecord(null);
    } catch {
      window.alert("削除に失敗しました。時間をおいて再度お試しください。");
    }
  }

  const sortedRecords = [...records].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          + 記録を追加
        </button>
      </div>

      {!isLoaded ? (
        <div className="py-12 text-center text-sm text-zinc-400">
          読み込み中...
        </div>
      ) : sortedRecords.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500">
          {config.emptyMessage}
        </div>
      ) : (
        <ul className="space-y-3">
          {sortedRecords.map((record) => (
            <li
              key={record.id}
              className="rounded-md border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <span>{formatDate(record.date) || "日付未設定"}</span>
                    {config.hasAmount && record.amount != null && (
                      <span className="font-medium text-zinc-700">
                        {formatCurrency(record.amount)}
                      </span>
                    )}
                  </div>
                  {record.title && (
                    <p className="mt-1 font-medium text-zinc-900">
                      {record.title}
                    </p>
                  )}
                  {record.content && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">
                      {record.content}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => openEditForm(record)}
                    className="text-violet-600 hover:text-violet-800"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingRecord(record)}
                    className="text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isFormOpen && (
        <RecordFormModal
          categoryLabel={config.label}
          hasAmount={config.hasAmount}
          record={editingRecord}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}

      {deletingRecord && (
        <ConfirmDialog
          title="記録の削除"
          message="この記録を削除します。この操作は取り消せません。よろしいですか？"
          confirmLabel="削除する"
          onCancel={() => setDeletingRecord(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
