"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerCustomerForRequest } from "@/lib/customers/linking";

interface RegisterCustomerButtonProps {
  requestId: string;
}

// 既存(顧客未登録)の無料鑑定申込を、スタッフの操作で顧客(customers)として
// 登録するためのボタン。新しい顧客レコードを作成するだけで、既存customersへの
// 自動統合は行わない(ロジックは変更していない。デザインのみ状態表示的に調整)。
export function RegisterCustomerButton({
  requestId,
}: RegisterCustomerButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setIsSubmitting(true);
    setError("");
    try {
      await registerCustomerForRequest(requestId);
      router.refresh();
    } catch {
      setError("登録に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-zinc-600">
        <span className="mr-1.5 inline-block rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
          未登録
        </span>
        顧客登録すると、有料鑑定・アップセルの購入履歴を記録できるようになります。
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isSubmitting}
        className="shrink-0 rounded-md bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {isSubmitting ? "登録中..." : "顧客として登録する"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
