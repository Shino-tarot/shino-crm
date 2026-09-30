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
import { createCustomerForNewApplication } from "@/lib/customers/linking";

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

// 新規の無料鑑定申込を保存する直前に顧客(customers)を1件自動作成し、customer_idを
// 紐付ける。既存customersへの自動統合は行わない(LINE表示名等による誤マージ事故を
// 避けるため、常に新規作成のみ)。万一顧客作成に失敗しても、本来の申込保存自体は
// 継続できるよう、customer_id=nullにフォールバックする(後からスタッフが手動で
// 「顧客として登録する」操作を行える)。
async function createCustomerSafely(seed: {
  lineName: string;
  readingName: string;
  birthDate: string | null;
  gender: string | null;
  age: number | null;
}): Promise<string | null> {
  try {
    return await createCustomerForNewApplication(seed);
  } catch (error) {
    console.error("[customers] auto create failed:", error);
    return null;
  }
}

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

  const customerId = await createCustomerSafely({
    lineName: result.data.lineName ?? "",
    readingName: result.data.name,
    birthDate: result.data.birthDate,
    gender: result.data.gender,
    age: null,
  });

  const { error } = await supabaseServerClient.from("free_reading_requests").insert({
    ...normalizedRequestToInsertRow(result.data),
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

// PostgRESTのilikeパターンとして解釈されないよう、line_name中の%と_をエスケープする
function escapeLikePattern(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

// 同じLINE表示名を持つ他の申込を「過去の無料鑑定履歴」として取得する。
// line_nameは前後空白や大文字小文字の違いで別人扱いにならないよう、
// DB側ではilikeで緩めに絞り込み、最終的な同一判定はJS側でtrim+小文字化した完全一致で行う
// (部分一致のレコードが誤って履歴に含まれないようにするため)。
// これはあくまで「候補表示」であり、実際に同一顧客として扱うかはスタッフが
// 「同じ顧客として紐付ける」操作で明示的に判断する(customer_idの自動統合はしない)。
export async function listFreeReadingRequestHistory(
  lineName: string,
  excludeId: string,
): Promise<FreeReadingRequestListItem[]> {
  const trimmed = lineName.trim();
  if (!trimmed) return [];

  const { data, error } = await supabaseServerClient
    .from("free_reading_requests")
    .select("*")
    .ilike("line_name", `%${escapeLikePattern(trimmed)}%`)
    .neq("id", excludeId)
    .order("application_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const target = trimmed.toLowerCase();
  return (data as FreeReadingRequestRow[])
    .filter((row) => row.line_name.trim().toLowerCase() === target)
    .map(rowToRequestListItem);
}

export type SaveHearingResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

// LINEでのヒアリングを管理画面から手動登録する(公開フォーム経由ではないため
// honeypot等のスパム対策は不要)。公開フォーム同様、新規申込のため顧客を
// 自動作成してcustomer_idを紐付ける(既存customersへの自動統合はしない)。
export async function createHearingRequest(
  values: HearingFormValues,
): Promise<SaveHearingResult> {
  const result = validateHearingForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  const customerId = await createCustomerSafely({
    lineName: result.data.lineName,
    readingName: result.data.name,
    birthDate: result.data.birthDate,
    gender: null,
    age: null,
  });

  const { data, error } = await supabaseServerClient
    .from("free_reading_requests")
    .insert({ ...hearingToInsertRow(result.data), customer_id: customerId })
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

// 既存申込の編集では顧客の自動作成・自動統合は行わない
// (未紐付けの場合は「顧客として登録する」操作をスタッフが明示的に行う)。
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
// この削除がcustomersや、その顧客に紐づくpaid_readings/upsell_purchasesへ
// 影響することはない。
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
