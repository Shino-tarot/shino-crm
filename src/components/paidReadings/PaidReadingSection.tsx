"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaidReading, PaidReadingFormValues } from "@/types/paidReading";
import {
  createPaidReading,
  deletePaidReading,
  updatePaidReading,
} from "@/lib/paidReadings/actions";
import { PaidReadingCard } from "@/components/paidReadings/PaidReadingCard";
import { PaidReadingFormModal } from "@/components/paidReadings/PaidReadingFormModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface PaidReadingSectionProps {
  customerId: string | null;
  readings: PaidReading[];
}

// customerId未紐付けの場合は追加できない(先に顧客登録が必要)。
// 保存・削除の成否に応じてrouter.refresh()でサーバーの最新データを再取得する。
export function PaidReadingSection({
  customerId,
  readings,
}: PaidReadingSectionProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<PaidReading | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<PaidReading | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function openCreateForm() {
    setEditingTarget(null);
    setIsFormOpen(true);
  }

  function openEditForm(reading: PaidReading) {
    setEditingTarget(reading);
    setIsFormOpen(true);
  }

  async function handleSubmit(values: PaidReadingFormValues) {
    if (!customerId) {
      return { ok: false as const, errors: { _form: "顧客登録が必要です。" } };
    }
    const result = editingTarget
      ? await updatePaidReading(editingTarget.id, values)
      : await createPaidReading(customerId, values);
    if (result.ok) {
      setIsFormOpen(false);
      setEditingTarget(null);
      router.refresh();
    }
    return result;
  }

  async function handleConfirmDelete() {
    if (!deletingTarget) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deletePaidReading(deletingTarget.id);
      setDeletingTarget(null);
      router.refresh();
    } catch {
      setDeleteError("削除に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsDeleting(false);
    }
  }

  if (!customerId) {
    return (
      <section className="mt-10 border-t border-zinc-200 pt-6">
        <h2 className="text-sm font-semibold text-zinc-900">有料鑑定履歴</h2>
        <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          顧客登録すると、有料鑑定の購入履歴を記録できるようになります。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          有料鑑定履歴（{readings.length}件）
        </h2>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
        >
          + 追加
        </button>
      </div>

      {readings.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          有料鑑定の購入履歴はまだありません。
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {readings.map((reading) => (
            <PaidReadingCard
              key={reading.id}
              reading={reading}
              onEdit={() => openEditForm(reading)}
              onDelete={() => setDeletingTarget(reading)}
            />
          ))}
        </ul>
      )}

      {isFormOpen && (
        <PaidReadingFormModal
          target={editingTarget}
          onClose={() => {
            setIsFormOpen(false);
            setEditingTarget(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {deletingTarget && (
        <ConfirmDialog
          title="有料鑑定履歴の削除"
          message={
            <>
              「{deletingTarget.productName || "（商品名未入力）"}」（
              {deletingTarget.purchaseDate}）を削除します。
              <br />
              この操作は取り消せません。よろしいですか？
            </>
          }
          confirmLabel="削除する"
          confirmingLabel="削除中..."
          isConfirming={isDeleting}
          onCancel={() => setDeletingTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
      {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
    </section>
  );
}
