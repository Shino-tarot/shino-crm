"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { FreeReadingFormValues } from "@/types/freeReadingRequest";
import { validateFreeReadingForm } from "@/lib/freeReadingRequests/validation";
import {
  FreeReadingRequestListItem,
  FreeReadingRequestRow,
  normalizedRequestToInsertRow,
  rowToRequestListItem,
} from "@/lib/freeReadingRequests/mapper";

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

  const { error } = await supabaseServerClient
    .from("free_reading_requests")
    .insert(normalizedRequestToInsertRow(result.data));

  if (error) {
    console.error("[free-reading] insert failed:", error.message);
    return {
      ok: false,
      errors: { _form: "送信に失敗しました。時間をおいて再度お試しください。" },
    };
  }

  return { ok: true };
}

export async function listFreeReadingRequests(): Promise<
  FreeReadingRequestListItem[]
> {
  const { data, error } = await supabaseServerClient
    .from("free_reading_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as FreeReadingRequestRow[]).map(rowToRequestListItem);
}
