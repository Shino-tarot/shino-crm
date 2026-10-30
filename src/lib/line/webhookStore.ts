import "server-only";
import { supabaseServerClient } from "@/lib/supabase/server";
import { LineWebhookStore } from "@/lib/line/processWebhook";
import { AccountId } from "@/lib/accounts/accounts";

// UNIQUE制約違反(PostgreSQLのエラーコード)
const UNIQUE_VIOLATION = "23505";

const PROFILE_TIMEOUT_MS = 3000;

interface LineProfile {
  displayName: string;
  pictureUrl: string | null;
}

// LINEのプロフィール(表示名・アイコン)を取得する。メッセージの送信は行わない。
// アクセストークン未設定・取得失敗時はnull(表示名は空のまま保存し、Webhook処理は止めない)。
async function fetchLineProfile(
  lineUserId: string,
  accessToken: string | undefined,
): Promise<LineProfile | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[line-webhook] profile fetch failed:", res.status);
      return null;
    }
    const json = (await res.json()) as { displayName?: unknown; pictureUrl?: unknown };
    return {
      displayName: typeof json.displayName === "string" ? json.displayName : "",
      pictureUrl: typeof json.pictureUrl === "string" ? json.pictureUrl : null,
    };
  } catch {
    console.warn("[line-webhook] profile fetch failed: network");
    return null;
  }
}

// エラー内容には値が含まれうるため、ログにはエラーコードのみ出す
function fail(step: string, code: string | undefined): never {
  console.error(`[line-webhook] ${step} failed:`, code ?? "unknown");
  throw new Error(`LINE_WEBHOOK_${step.toUpperCase()}_FAILED`);
}

// accountId: このWebhookの受け口が受け取るLINE公式アカウント(署名を検証したチャネルで決まる)。
// LINE送信者・会話履歴は、すべてこのアカウントの中で作成・検索する
export function createSupabaseLineWebhookStore(
  accountId: AccountId,
  accessToken: string | undefined,
): LineWebhookStore {
  async function findContact(lineUserId: string) {
    const { data, error } = await supabaseServerClient
      .from("line_contacts")
      .select("id, display_name")
      .eq("account_id", accountId)
      .eq("line_user_id", lineUserId)
      .maybeSingle();
    if (error) fail("find_contact", error.code);
    return data as { id: string; display_name: string } | null;
  }

  async function fillProfileIfMissing(contactId: string, lineUserId: string) {
    const profile = await fetchLineProfile(lineUserId, accessToken);
    if (!profile || !profile.displayName) return;
    const { error } = await supabaseServerClient
      .from("line_contacts")
      .update({ display_name: profile.displayName, picture_url: profile.pictureUrl })
      .eq("id", contactId)
      .eq("account_id", accountId);
    // 表示名の保存失敗はメッセージ保存を止めない
    if (error) console.warn("[line-webhook] profile update failed:", error.code);
  }

  return {
    async ensureContact(lineUserId, lastMessageAt) {
      let contact = await findContact(lineUserId);

      if (!contact) {
        const { data, error } = await supabaseServerClient
          .from("line_contacts")
          .insert({ account_id: accountId, line_user_id: lineUserId, last_message_at: lastMessageAt })
          .select("id, display_name")
          .single();
        if (error && error.code !== UNIQUE_VIOLATION) fail("insert_contact", error.code);
        // 同時に届いた別のWebhookが先に作成していた場合は、その行を使う
        contact = data ?? (await findContact(lineUserId));
        if (!contact) fail("insert_contact", "not_found_after_conflict");
      } else if (lastMessageAt) {
        // 再送・順不同で届いた古いイベントで最終受信日時を巻き戻さない
        const { error } = await supabaseServerClient
          .from("line_contacts")
          .update({ last_message_at: lastMessageAt })
          .eq("id", contact.id)
          .eq("account_id", accountId)
          .or(`last_message_at.is.null,last_message_at.lt.${lastMessageAt}`);
        if (error) fail("update_contact", error.code);
      }

      if (!contact.display_name) {
        await fillProfileIfMissing(contact.id, lineUserId);
      }
      return contact.id;
    },

    async insertIncomingMessage(contactId, record) {
      const { error } = await supabaseServerClient.from("conversation_messages").insert({
        account_id: accountId,
        line_contact_id: contactId,
        direction: "incoming",
        source: "line_webhook",
        message_type: record.messageType,
        body: record.body,
        sent_at: record.sentAt,
        line_webhook_event_id: record.webhookEventId,
        line_message_id: record.lineMessageId,
      });
      if (!error) return "inserted";
      if (error.code === UNIQUE_VIOLATION) return "duplicate";
      fail("insert_message", error.code);
    },

    async updateFriendStatus(change) {
      const { error } = await supabaseServerClient
        .from("line_contacts")
        .update({ friend_status: change.friendStatus })
        .eq("account_id", accountId)
        .eq("line_user_id", change.lineUserId);
      if (error) fail("update_friend_status", error.code);
    },
  };
}
