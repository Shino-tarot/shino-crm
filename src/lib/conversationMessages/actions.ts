"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { isCustomerInAccount, requireStaffAccount } from "@/lib/accounts/current";
import { AccountId } from "@/lib/accounts/accounts";
import {
  ConversationMessage,
  ConversationMessageFormValues,
} from "@/types/conversationMessage";
import {
  isUuid,
  validateConversationMessageForm,
} from "@/lib/conversationMessages/validation";
import {
  CONVERSATION_MESSAGE_COLUMNS,
  ConversationMessageRow,
  compareConversationMessages,
  conversationMessageToRow,
  rowToConversationMessage,
} from "@/lib/conversationMessages/mapper";

// 管理画面用のServer Action。全ての関数の先頭でrequireStaffAccount()を呼び、未ログイン・管理者以外と、
// 画面を表示したときと選択中のアカウントが違う操作を拒否する。
// LINE自動保存(source='line_webhook')の履歴はDB側のトリガーでも変更・削除が拒否されるが、
// アプリ側でも更新・削除の対象を source='manual' に限定する(0012_conversation_history.sql参照)。

export type SaveConversationMessageResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

// 顧客の会話履歴を送受信日時の古い順で返す。論理削除済みの手動登録は含めない。
//   - 手動登録: conversation_messages.customer_id で紐づく
//   - LINE自動保存: line_contacts.customer_id 経由で紐づく(履歴側はcustomer_idを持たない)
// 全ての関数の第1引数は「画面を表示したときのアカウント」。そのアカウントの会話履歴だけを読み書きする
export async function listConversationMessages(
  accountId: AccountId,
  customerId: string,
): Promise<ConversationMessage[]> {
  await requireStaffAccount(accountId);
  if (!isUuid(customerId)) return [];

  const [manualRes, contactRes] = await Promise.all([
    supabaseServerClient
      .from("conversation_messages")
      .select(CONVERSATION_MESSAGE_COLUMNS)
      .eq("customer_id", customerId)
      .eq("account_id", accountId)
      .eq("source", "manual")
      .is("deleted_at", null),
    supabaseServerClient
      .from("line_contacts")
      .select("id")
      .eq("customer_id", customerId)
      .eq("account_id", accountId)
      .maybeSingle(),
  ]);
  if (manualRes.error) throw new Error(manualRes.error.message);
  if (contactRes.error) throw new Error(contactRes.error.message);

  let webhookRows: ConversationMessageRow[] = [];
  if (contactRes.data) {
    const { data, error } = await supabaseServerClient
      .from("conversation_messages")
      .select(CONVERSATION_MESSAGE_COLUMNS)
      .eq("line_contact_id", contactRes.data.id)
      .eq("account_id", accountId)
      .eq("source", "line_webhook");
    if (error) throw new Error(error.message);
    webhookRows = data as ConversationMessageRow[];
  }

  return [...(manualRes.data as ConversationMessageRow[]), ...webhookRows]
    .map(rowToConversationMessage)
    .sort(compareConversationMessages);
}

export async function createConversationMessage(
  accountId: AccountId,
  customerId: string,
  values: ConversationMessageFormValues,
): Promise<SaveConversationMessageResult> {
  const { staff } = await requireStaffAccount(accountId);
  if (!isUuid(customerId) || !(await isCustomerInAccount(accountId, customerId))) {
    return { ok: false, errors: { _form: "顧客が正しく指定されていません。" } };
  }
  const result = validateConversationMessageForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  const { data, error } = await supabaseServerClient
    .from("conversation_messages")
    .insert({
      account_id: accountId,
      customer_id: customerId,
      source: "manual",
      message_type: "text",
      ...conversationMessageToRow(result.data),
      created_by: staff.id,
      updated_by: staff.id,
    })
    .select("id")
    .single();

  if (error) {
    // 本文は個人情報のためログに出さない
    console.error("[conversation-messages] insert failed:", error.message);
    return {
      ok: false,
      errors: { _form: "登録に失敗しました。時間をおいて再度お試しください。" },
    };
  }
  return { ok: true, id: data.id };
}

export async function updateConversationMessage(
  accountId: AccountId,
  id: string,
  values: ConversationMessageFormValues,
): Promise<SaveConversationMessageResult> {
  const { staff } = await requireStaffAccount(accountId);
  if (!isUuid(id)) {
    return { ok: false, errors: { _form: "対象の履歴が見つかりません。" } };
  }
  const result = validateConversationMessageForm(values);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  // 顧客の付け替え・登録種別の変更はしない(本文・日時・送受信のみ更新)
  const { data, error } = await supabaseServerClient
    .from("conversation_messages")
    .update({ ...conversationMessageToRow(result.data), updated_by: staff.id })
    .eq("id", id)
    .eq("account_id", accountId)
    .eq("source", "manual")
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("[conversation-messages] update failed:", error.message);
    return {
      ok: false,
      errors: { _form: "更新に失敗しました。時間をおいて再度お試しください。" },
    };
  }
  if (!data?.length) {
    return {
      ok: false,
      errors: { _form: "この履歴は削除済み、または編集できない履歴です。" },
    };
  }
  return { ok: true, id };
}

// 物理削除ではなく論理削除(deleted_atをセット)する。手動登録の履歴のみ対象。
// 呼び出し元(UI)で必ず確認ダイアログを表示してから呼ぶこと。
export async function deleteConversationMessage(accountId: AccountId, id: string): Promise<void> {
  const { staff } = await requireStaffAccount(accountId);
  if (!isUuid(id)) throw new Error("INVALID_ID");

  const { data, error } = await supabaseServerClient
    .from("conversation_messages")
    .update({ deleted_at: new Date().toISOString(), updated_by: staff.id })
    .eq("id", id)
    .eq("account_id", accountId)
    .eq("source", "manual")
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("[conversation-messages] delete failed:", error.message);
    throw new Error(error.message);
  }
  if (!data?.length) throw new Error("NOT_FOUND");
}
