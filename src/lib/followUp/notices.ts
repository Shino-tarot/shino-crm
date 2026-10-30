import "server-only";
import { cache } from "react";
import { supabaseServerClient } from "@/lib/supabase/server";
import {
  FOLLOW_UP_DELAY_MS,
  FOLLOW_UP_EXCLUDED_STATUSES,
  partitionFollowUpsByAccount,
} from "@/lib/followUp/rules";
import { ACCOUNTS, AccountId } from "@/lib/accounts/accounts";

export interface FollowUpNotice {
  id: string;
  name: string;
  lineName: string;
  sentAt: string;
}

export interface FollowUpNotices {
  // 表示中のアカウントの通知(他のアカウントの申込は含めない)
  newNotices: FollowUpNotice[];
  pastNotices: FollowUpNotice[];
  // 他のアカウントの新規通知の件数のみ(名前などの詳細は出さない。切り替えのきっかけ用)
  otherAccountNewCounts: { accountId: AccountId; count: number }[];
}

interface FollowUpRequestRow {
  id: string;
  account_id: AccountId;
  status: string;
  reading_name: string;
  line_name: string;
  sent_at: string;
  detail_request: string | null;
  followed_up_at: string | null;
  // 紐づく顧客の非表示状態(顧客未登録の申込はnull=通知対象のまま)
  customer: { deleted_at: string | null } | null;
}

const EMPTY_NOTICES: FollowUpNotices = { newNotices: [], pastNotices: [], otherAccountNewCounts: [] };

// 無料鑑定送信から24時間経過し、詳細希望が未回答かつ未フォローの申込を集める。
// CRMの画面表示時(と画面を開いている間の10分ごとの再読み込み)に読むだけで、DBへは書き込まない。
// LINE・メール等への自動送信は行わない。
// 失敗しても画面表示を止めないよう、エラーはログに出して通知なしとして扱う。
async function loadFollowUpNotices(accountId: AccountId): Promise<FollowUpNotices> {
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
      .select(
        "id, account_id, status, reading_name, line_name, sent_at, detail_request, followed_up_at, " +
          "customer:customers!free_reading_requests_customer_id_fkey(deleted_at)",
      )
      .not("sent_at", "is", null)
      .lte("sent_at", dueBefore)
      .is("detail_request", null)
      .is("followed_up_at", null)
      .not("status", "in", `(${FOLLOW_UP_EXCLUDED_STATUSES.join(",")})`)
      .order("sent_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data as unknown as FollowUpRequestRow[]).map((row) => ({
      ...row,
      customer_hidden: Boolean(row.customer?.deleted_at),
    }));
    const { newRows, pastRows, otherAccountNewCounts } = partitionFollowUpsByAccount(
      rows,
      accountId,
      launch.launched_at,
      now,
    );
    const toNotice = (row: FollowUpRequestRow): FollowUpNotice => ({
      id: row.id,
      name: row.reading_name,
      lineName: row.line_name,
      sentAt: row.sent_at,
    });
    const notices: FollowUpNotices = {
      newNotices: newRows.map(toNotice),
      pastNotices: pastRows.map(toNotice),
      otherAccountNewCounts: ACCOUNTS.filter((account) => otherAccountNewCounts.has(account.id)).map(
        (account) => ({ accountId: account.id, count: otherAccountNewCounts.get(account.id)! }),
      ),
    };
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
