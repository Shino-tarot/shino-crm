"use server";

// 公開フォーム(/free-reading)専用のServer Action。ログイン不要で呼ばれるため、
// このファイルには「新規申込の保存」以外の処理を置かないこと
// (管理画面用の処理はactions.tsに置き、requireStaff()で保護する)。

import { supabaseServerClient } from "@/lib/supabase/server";
import { FreeReadingFormValues } from "@/types/freeReadingRequest";
import { validateFreeReadingForm } from "@/lib/freeReadingRequests/validation";
import { normalizedRequestToInsertRow } from "@/lib/freeReadingRequests/mapper";
import { createCustomerSafely } from "@/lib/customers/createCustomer";
import { INBOUND_ACCOUNT_ID } from "@/lib/accounts/accounts";

const MIN_ELAPSED_MS = 2000;

export interface SubmitFreeReadingRequestMeta {
  // 人間には見せない隠しフィールド。値が入っていたらbotとみなす
  honeypot: string;
  // フォームが表示された時刻(クライアントでのDate.now())
  formLoadedAt: number;
}

export type SubmitFreeReadingRequestResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

export async function submitFreeReadingRequest(
  values: FreeReadingFormValues,
  meta: SubmitFreeReadingRequestMeta,
): Promise<SubmitFreeReadingRequestResult> {
  if (meta.honeypot.trim() !== "") {
    console.warn("[free-reading] blocked submission", { reason: "honeypot" });
    return { ok: true };
  }

  const elapsed = Date.now() - meta.formLoadedAt;
  if (!Number.isFinite(elapsed) || elapsed < MIN_ELAPSED_MS) {
    console.warn("[free-reading] blocked submission", {
      reason: "submitted_too_fast",
      elapsedMs: elapsed,
    });
    return { ok: true };
  }

  const result = validateFreeReadingForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  // 公開フォームは当面鯛子専用のため、申込・顧客とも鯛子として保存する
  const customerId = await createCustomerSafely({
    accountId: INBOUND_ACCOUNT_ID,
    lineName: result.data.lineName ?? "",
    readingName: result.data.name,
    birthDate: result.data.birthDate,
    gender: result.data.gender,
    age: null,
  });

  const { error } = await supabaseServerClient.from("free_reading_requests").insert({
    ...normalizedRequestToInsertRow(result.data),
    account_id: INBOUND_ACCOUNT_ID,
    customer_id: customerId,
  });

  if (error) {
    console.error("[free-reading] insert failed:", error.message);
    return {
      ok: false,
      errors: { _form: "送信に失敗しました。時間をおいて再度お試しください。" },
    };
  }

  return { ok: true };
}
