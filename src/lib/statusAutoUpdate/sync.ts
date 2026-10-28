import "server-only";
import { cache } from "react";
import { supabaseServerClient } from "@/lib/supabase/server";
import {
  AUTO_UPDATE_TARGET_STATUS,
  AutoUpdateEventType,
  shouldAdvanceStatus,
} from "@/lib/statusAutoUpdate/rules";

// 送信日時を過ぎた送信イベント(無料鑑定の送信 / 有料鑑定1件ごとの送信)を見つけ、
// 紐づく無料鑑定申込のステータスを自動で進める。CRMの画面表示時(と画面を開いている間の
// 10分ごとの再読み込み)に呼ばれる。外部Cronは使わない。
//
// 安全のための前提:
//   - 送信イベント1件につき、status_auto_updatesへ1行だけ記録する(UNIQUE制約)。
//     記録済みのイベントは、送信日時の修正や手動でのステータス変更後も二度と処理しない。
//   - 機能導入日時(crm_feature_launches.status_auto_update)より前の送信は対象外。
//   - 対応不要・完了、およびすでに同じか先の段階のステータスは進めない('skipped'として記録)。
//   - 失敗しても画面表示を止めないよう、エラーはログに出すだけで例外にしない。

const UNIQUE_VIOLATION = "23505";

interface DueEvent {
  eventType: AutoUpdateEventType;
  sourceId: string;
  requestId: string;
  sentAt: string;
}

async function getLaunchedAt(): Promise<string | null> {
  const { data, error } = await supabaseServerClient
    .from("crm_feature_launches")
    .select("launched_at")
    .eq("feature", "status_auto_update")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.launched_at ?? null;
}

async function listProcessedSourceIds(
  eventType: AutoUpdateEventType,
  sourceIds: string[],
): Promise<Set<string>> {
  if (sourceIds.length === 0) return new Set();
  const { data, error } = await supabaseServerClient
    .from("status_auto_updates")
    .select("source_id")
    .eq("event_type", eventType)
    .in("source_id", sourceIds);
  if (error) throw new Error(error.message);
  return new Set(data.map((row) => row.source_id as string));
}

async function listDueFreeReadingEvents(
  launchedAt: string,
  nowIso: string,
): Promise<DueEvent[]> {
  const { data, error } = await supabaseServerClient
    .from("free_reading_requests")
    .select("id, sent_at")
    .not("sent_at", "is", null)
    .lte("sent_at", nowIso)
    .gte("sent_at", launchedAt);
  if (error) throw new Error(error.message);

  const processed = await listProcessedSourceIds(
    "free_reading_sent",
    data.map((row) => row.id),
  );
  return data
    .filter((row) => !processed.has(row.id))
    .map((row) => ({
      eventType: "free_reading_sent",
      sourceId: row.id,
      requestId: row.id,
      sentAt: row.sent_at,
    }));
}

// 有料鑑定は顧客(customer_id)に紐づくため、その顧客の最新の無料鑑定申込
// (申込日→登録日時の新しい順で先頭)へステータスを反映する。
// 紐づく申込が無い有料鑑定は記録せずに見送る(申込が紐付いた後に処理される)。
async function listDuePaidReadingEvents(
  launchedAt: string,
  nowIso: string,
): Promise<DueEvent[]> {
  const { data, error } = await supabaseServerClient
    .from("paid_readings")
    .select("id, customer_id, sent_at")
    .is("deleted_at", null)
    .not("sent_at", "is", null)
    .lte("sent_at", nowIso)
    .gte("sent_at", launchedAt);
  if (error) throw new Error(error.message);

  const processed = await listProcessedSourceIds(
    "paid_reading_sent",
    data.map((row) => row.id),
  );
  const pending = data.filter((row) => !processed.has(row.id));
  if (pending.length === 0) return [];

  const customerIds = [...new Set(pending.map((row) => row.customer_id))];
  const { data: requests, error: requestsError } = await supabaseServerClient
    .from("free_reading_requests")
    .select("id, customer_id")
    .in("customer_id", customerIds)
    .order("application_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (requestsError) throw new Error(requestsError.message);

  const latestRequestByCustomer = new Map<string, string>();
  for (const request of requests) {
    if (!latestRequestByCustomer.has(request.customer_id)) {
      latestRequestByCustomer.set(request.customer_id, request.id);
    }
  }

  return pending.flatMap((row) => {
    const requestId = latestRequestByCustomer.get(row.customer_id);
    if (!requestId) return [];
    return [
      {
        eventType: "paid_reading_sent" as const,
        sourceId: row.id,
        requestId,
        sentAt: row.sent_at,
      },
    ];
  });
}

async function getCurrentStatus(requestId: string): Promise<string | null> {
  const { data, error } = await supabaseServerClient
    .from("free_reading_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.status ?? null;
}

async function processEvent(event: DueEvent): Promise<void> {
  const fromStatus = await getCurrentStatus(event.requestId);
  if (fromStatus === null) return;

  const toStatus = AUTO_UPDATE_TARGET_STATUS[event.eventType];
  const willAdvance = shouldAdvanceStatus(fromStatus, toStatus);

  // 先に履歴を記録して、このイベントの処理権を確保する。
  // 同時に別の画面表示が同じイベントを処理していた場合はUNIQUE制約で弾かれるので何もしない。
  const { data: logRow, error: logError } = await supabaseServerClient
    .from("status_auto_updates")
    .insert({
      free_reading_request_id: event.requestId,
      event_type: event.eventType,
      source_id: event.sourceId,
      from_status: fromStatus,
      to_status: toStatus,
      result: willAdvance ? "applied" : "skipped",
    })
    .select("id")
    .single();
  if (logError) {
    if (logError.code === UNIQUE_VIOLATION) return;
    throw new Error(logError.message);
  }
  if (!willAdvance) return;

  // 判定後にステータスが変わっていた場合(手動変更など)は上書きしない。
  const { data: updated, error: updateError } = await supabaseServerClient
    .from("free_reading_requests")
    .update({ status: toStatus })
    .eq("id", event.requestId)
    .eq("status", fromStatus)
    .select("id");
  if (updateError || !updated?.length) {
    await supabaseServerClient
      .from("status_auto_updates")
      .update({ result: "skipped" })
      .eq("id", logRow.id);
    if (updateError) throw new Error(updateError.message);
  }
}

async function runStatusAutoUpdate(): Promise<void> {
  try {
    const launchedAt = await getLaunchedAt();
    // 0011マイグレーション未適用(導入日時なし)の環境では何もしない
    if (!launchedAt) return;

    const nowIso = new Date().toISOString();
    const [freeEvents, paidEvents] = await Promise.all([
      listDueFreeReadingEvents(launchedAt, nowIso),
      listDuePaidReadingEvents(launchedAt, nowIso),
    ]);

    // 無料鑑定→有料鑑定の順に、送信日時の古いものから1件ずつ処理する
    const bySentAt = (a: DueEvent, b: DueEvent) => a.sentAt.localeCompare(b.sentAt);
    for (const event of [
      ...freeEvents.sort(bySentAt),
      ...paidEvents.sort(bySentAt),
    ]) {
      await processEvent(event);
    }
  } catch (error) {
    console.error(
      "[status-auto-update] failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

// 同じリクエスト内(レイアウトとページ)で複数回呼ばれても1回だけ実行する
export const syncAutoStatuses = cache(runStatusAutoUpdate);
