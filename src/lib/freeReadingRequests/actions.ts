"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { FreeReadingFormValues, HearingFormValues } from "@/types/freeReadingRequest";
import {
  validateFreeReadingForm,
  validateHearingForm,
} from "@/lib/freeReadingRequests/validation";
import {
  FreeReadingRequestListItem,
  FreeReadingRequestRow,
  hearingToInsertRow,
  hearingToUpdateRow,
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
    // 申込日(application_date)の新しい順。未入力は末尾に表示し、
    // 同一申込日内はCRM登録日時(created_at)の新しい順で安定させる
    .order("application_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as FreeReadingRequestRow[]).map(rowToRequestListItem);
}

export async function getFreeReadingRequest(
  id: string,
): Promise<FreeReadingRequestRow | null> {
  const { data, error } = await supabaseServerClient
    .from("free_reading_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as FreeReadingRequestRow | null;
}

export type SaveHearingResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

// LINEでのヒアリングを管理画面から手動登録する(公開フォーム経由ではないため
// honeypot等のスパム対策は不要)。
export async function createHearingRequest(
  values: HearingFormValues,
): Promise<SaveHearingResult> {
  const result = validateHearingForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  const { data, error } = await supabaseServerClient
    .from("free_reading_requests")
    .insert(hearingToInsertRow(result.data))
    .select("id")
    .single();

  if (error) {
    console.error("[hearing] insert failed:", error.message);
    return {
      ok: false,
      errors: { _form: "登録に失敗しました。時間をおいて再度お試しください。" },
    };
  }

  return { ok: true, id: data.id };
}

export async function updateHearingRequest(
  id: string,
  values: HearingFormValues,
): Promise<SaveHearingResult> {
  const result = validateHearingForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  const { error } = await supabaseServerClient
    .from("free_reading_requests")
    .update(hearingToUpdateRow(result.data))
    .eq("id", id);

  if (error) {
    console.error("[hearing] update failed:", error.message);
    return {
      ok: false,
      errors: { _form: "更新に失敗しました。時間をおいて再度お試しください。" },
    };
  }

  return { ok: true, id };
}

// 削除対象はfree_reading_requestsの該当レコードのみ。
// customer_idはfree_reading_requests側が持つ参照(customers.id)であり、
// customers側に本テーブルへの外部キー・カスケード設定は存在しないため、
// この削除がcustomersのデータへ影響することはない。
export async function deleteFreeReadingRequest(id: string): Promise<void> {
  const { error } = await supabaseServerClient
    .from("free_reading_requests")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[free-reading] delete failed:", error.message);
    throw new Error(error.message);
  }
}
