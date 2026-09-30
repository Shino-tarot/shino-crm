"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpsellPurchase, UpsellPurchaseFormValues } from "@/types/upsellPurchase";
import {
  createUpsellPurchase,
  deleteUpsellPurchase,
  updateUpsellPurchase,
} from "@/lib/upsellPurchases/actions";
import { UpsellPurchaseCard } from "@/components/upsellPurchases/UpsellPurchaseCard";
import { UpsellPurchaseFormModal } from "@/components/upsellPurchases/UpsellPurchaseFormModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface UpsellPurchaseSectionProps {
  customerId: string | null;
  purchases: UpsellPurchase[];
}

export function UpsellPurchaseSection({
  customerId,
  purchases,
}: UpsellPurchaseSectionProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<UpsellPurchase | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<UpsellPurchase | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function openCreateForm() {
    setEditingTarget(null);
    setIsFormOpen(true);
  }

  function openEditForm(purchase: UpsellPurchase) {
    setEditingTarget(purchase);
    setIsFormOpen(true);
  }

  async function handleSubmit(values: UpsellPurchaseFormValues) {
    if (!customerId) {
      return { ok: false as const, errors: { _form: "顧客登録が必要です。" } };
    }
    const result = editingTarget
      ? await updateUpsellPurchase(editingTarget.id, values)
      : await createUpsellPurchase(customerId, values);
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
      await deleteUpsellPurchase(deletingTarget.id);
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
        <h2 className="text-sm font-semibold text-zinc-900">
          アップセル購入履歴
        </h2>
        <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          顧客登録すると、アップセル商品の購入履歴を記録できるようになります。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          アップセル購入履歴（{purchases.length}件）
        </h2>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
        >
          + 追加
        </button>
      </div>

      {purchases.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          アップセル購入の履歴はまだありません。
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {purchases.map((purchase) => (
            <UpsellPurchaseCard
              key={purchase.id}
              purchase={purchase}
              onEdit={() => openEditForm(purchase)}
              onDelete={() => setDeletingTarget(purchase)}
            />
          ))}
        </ul>
      )}

      {isFormOpen && (
        <UpsellPurchaseFormModal
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
          title="アップセル購入履歴の削除"
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
