import "server-only";
import { cache } from "react";
import { supabaseServerClient } from "@/lib/supabase/server";
import {
  FOLLOW_UP_DELAY_MS,
  FOLLOW_UP_EXCLUDED_STATUSES,
  classifyFollowUp,
} from "@/lib/followUp/rules";

export interface FollowUpNotice {
  id: string;
  name: string;
  lineName: string;
  sentAt: string;
}

export interface FollowUpNotices {
  newNotices: FollowUpNotice[];
  pastNotices: FollowUpNotice[];
}

const EMPTY_NOTICES: FollowUpNotices = { newNotices: [], pastNotices: [] };

// 無料鑑定送信から24時間経過し、詳細希望が未回答かつ未フォローの申込を集める。
// CRMの画面表示時(と画面を開いている間の10分ごとの再読み込み)に読むだけで、DBへは書き込まない。
// LINE・メール等への自動送信は行わない。
// 失敗しても画面表示を止めないよう、エラーはログに出して通知なしとして扱う。
async function loadFollowUpNotices(): Promise<FollowUpNotices> {
  try {
    const { data: launch, error: launchError } = await supabaseServerClient
      .from("crm_feature_launches")
      .select("launched_at")
      .eq("feature", "followup_notice")
      .maybeSingle();
    if (launchError) throw new Error(launchError.message);
    // 0011マイグレーション未適用(導入日時なし)の環境では通知しない
    if (!launch) return EMPTY_NOTICES;

    const now = new Date();
    const dueBefore = new Date(now.getTime() - FOLLOW_UP_DELAY_MS).toISOString();
    const { data, error } = await supabaseServerClient
      .from("free_reading_requests")
      .select("id, status, reading_name, line_name, sent_at, detail_request, followed_up_at")
      .not("sent_at", "is", null)
      .lte("sent_at", dueBefore)
      .is("detail_request", null)
      .is("followed_up_at", null)
      .not("status", "in", `(${FOLLOW_UP_EXCLUDED_STATUSES.join(",")})`)
      .order("sent_at", { ascending: true });
    if (error) throw new Error(error.message);

    const notices: FollowUpNotices = { newNotices: [], pastNotices: [] };
    for (const row of data) {
      const category = classifyFollowUp(row, launch.launched_at, now);
      if (!category) continue;
      const notice = {
        id: row.id,
        name: row.reading_name,
        lineName: row.line_name,
        sentAt: row.sent_at,
      };
      (category === "new" ? notices.newNotices : notices.pastNotices).push(notice);
    }
    return notices;
  } catch (error) {
    console.error(
      "[follow-up-notice] failed:",
      error instanceof Error ? error.message : error,
    );
    return EMPTY_NOTICES;
  }
}

export const getFollowUpNotices = cache(loadFollowUpNotices);
