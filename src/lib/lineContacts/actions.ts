"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { requireStaffAccount } from "@/lib/accounts/current";
import { AccountId } from "@/lib/accounts/accounts";
import { isUuid } from "@/lib/conversationMessages/validation";
import {
  CONVERSATION_MESSAGE_COLUMNS,
  ConversationMessageRow,
  compareConversationMessages,
  rowToConversationMessage,
} from "@/lib/conversationMessages/mapper";
import {
  LINK_BLOCK_MESSAGES,
  SEARCH_RESULT_LIMIT,
  getLinkBlockReason,
  linkErrorMessageFromDbCode,
  normalizeSearchQuery,
  parseCustomerNo,
  toIlikePattern,
} from "@/lib/lineContacts/rules";
import { ConversationMessage } from "@/types/conversationMessage";
import {
  LineContact,
  LineFriendStatus,
  LinkCandidate,
  LinkedCustomer,
} from "@/types/lineContact";

// LINE送信者(line_contacts)と顧客の紐づけ用Server Action。全ての関数の先頭でrequireStaffAccount()を呼ぶ。
//   - 紐づけはスタッフが顧客を選んで確認した場合のみ行う(表示名等による自動判定はしない)
//   - LINEユーザーIDはサーバー内の判定にのみ使い、画面へ返さない・ログに出さない
//   - 紐づけ・解除は line_contacts の1行だけを更新する(会話履歴は変更・削除しない)
//   - 全ての関数の第1引数は「画面を表示したときのアカウント」。同じアカウントの送信者・顧客どうしのみ扱う

export type LineContactActionResult = { ok: true } | { ok: false; error: string };

// 1人の送信者の履歴表示の上限(古いものから切り捨てる)
const CONTACT_MESSAGE_LIMIT = 500;

const CUSTOMER_COLUMNS = "id, customer_no, reading_name, line_name, real_name";

const CONTACT_COLUMNS =
  "id, display_name, picture_url, friend_status, last_message_at, linked_at, created_at, " +
  `customer:customers!line_contacts_customer_id_fkey(${CUSTOMER_COLUMNS}), ` +
  "conversation_messages(count)";

interface CustomerRow {
  id: string;
  customer_no: number;
  reading_name: string;
  line_name: string;
  real_name: string;
}

interface LineContactRow {
  id: string;
  display_name: string;
  picture_url: string | null;
  friend_status: LineFriendStatus;
  last_message_at: string | null;
  linked_at: string | null;
  created_at: string;
  customer: CustomerRow | null;
  conversation_messages: { count: number }[];
}

function rowToLinkedCustomer(row: CustomerRow): LinkedCustomer {
  return {
    id: row.id,
    customerNo: row.customer_no,
    readingName: row.reading_name,
    lineName: row.line_name,
    realName: row.real_name,
  };
}

function rowToLineContact(row: LineContactRow): LineContact {
  return {
    id: row.id,
    displayName: row.display_name,
    pictureUrl: row.picture_url,
    friendStatus: row.friend_status,
    lastMessageAt: row.last_message_at,
    linkedAt: row.linked_at,
    createdAt: row.created_at,
    messageCount: row.conversation_messages?.[0]?.count ?? 0,
    customer: row.customer ? rowToLinkedCustomer(row.customer) : null,
  };
}

// エラー内容には値が含まれうるため、ログにはエラーコードのみ出す
function logError(step: string, code: string | undefined) {
  console.error(`[line-contacts] ${step} failed:`, code ?? "unknown");
}

// LINE送信者の一覧(最終受信日時の新しい順)
export async function listLineContacts(accountId: AccountId): Promise<LineContact[]> {
  await requireStaffAccount(accountId);
  const { data, error } = await supabaseServerClient
    .from("line_contacts")
    .select(CONTACT_COLUMNS)
    .eq("account_id", accountId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    logError("list", error.code);
    throw new Error("LINE_CONTACTS_LIST_FAILED");
  }
  return (data as unknown as LineContactRow[]).map(rowToLineContact);
}

// LINE送信者1件と、LINEから自動保存した受信メッセージ(古い順)
export async function getLineContactDetail(
  accountId: AccountId,
  id: string,
): Promise<{ contact: LineContact; messages: ConversationMessage[] } | null> {
  await requireStaffAccount(accountId);
  if (!isUuid(id)) return null;

  const [contactRes, messagesRes] = await Promise.all([
    supabaseServerClient
      .from("line_contacts")
      .select(CONTACT_COLUMNS)
      .eq("id", id)
      .eq("account_id", accountId)
      .maybeSingle(),
    supabaseServerClient
      .from("conversation_messages")
      .select(CONVERSATION_MESSAGE_COLUMNS)
      .eq("line_contact_id", id)
      .eq("account_id", accountId)
      .eq("source", "line_webhook")
      .order("sent_at", { ascending: false })
      .limit(CONTACT_MESSAGE_LIMIT),
  ]);
  if (contactRes.error) {
    logError("get", contactRes.error.code);
    throw new Error("LINE_CONTACT_GET_FAILED");
  }
  if (messagesRes.error) {
    logError("get_messages", messagesRes.error.code);
    throw new Error("LINE_CONTACT_GET_FAILED");
  }
  if (!contactRes.data) return null;

  return {
    contact: rowToLineContact(contactRes.data as unknown as LineContactRow),
    messages: (messagesRes.data as ConversationMessageRow[])
      .map(rowToConversationMessage)
      .sort(compareConversationMessages),
  };
}

// 判定に使う送信者の情報(LINEユーザーIDを含むためサーバー内でのみ使う)
async function findContactForLinking(
  accountId: AccountId,
  contactId: string,
): Promise<{ id: string; lineUserId: string; customerId: string | null } | null> {
  const { data, error } = await supabaseServerClient
    .from("line_contacts")
    .select("id, line_user_id, customer_id")
    .eq("id", contactId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    logError("find_contact", error.code);
    throw new Error("LINE_CONTACT_FIND_FAILED");
  }
  if (!data) return null;
  return { id: data.id, lineUserId: data.line_user_id, customerId: data.customer_id };
}

// この送信者のLINEユーザーIDが登録されている顧客のid一覧(DBトリガーと同じく前後の空白は無視する)
async function findLineUserIdOwnerCustomerIds(
  accountId: AccountId,
  lineUserId: string,
): Promise<string[]> {
  // LINEユーザーIDは U+英数字のみ(DBのCHECK制約で保証)のため、パターン文字は含まれない
  const { data, error } = await supabaseServerClient
    .from("customers")
    .select("id, line_user_id")
    .eq("account_id", accountId)
    .like("line_user_id", `%${lineUserId}%`);
  if (error) {
    logError("find_owner", error.code);
    throw new Error("LINE_CONTACT_FIND_OWNER_FAILED");
  }
  return (data as { id: string; line_user_id: string }[])
    .filter((row) => row.line_user_id.trim() === lineUserId)
    .map((row) => row.id);
}

// 顧客ごとに、既に紐づいているLINE送信者のid
async function findLinkedContactIdsByCustomer(
  accountId: AccountId,
  customerIds: string[],
): Promise<Map<string, string>> {
  if (customerIds.length === 0) return new Map();
  const { data, error } = await supabaseServerClient
    .from("line_contacts")
    .select("id, customer_id")
    .eq("account_id", accountId)
    .in("customer_id", customerIds);
  if (error) {
    logError("find_linked", error.code);
    throw new Error("LINE_CONTACT_FIND_LINKED_FAILED");
  }
  return new Map(
    (data as { id: string; customer_id: string }[]).map((row) => [row.customer_id, row.id]),
  );
}

// 紐づけ先の顧客を名前(鑑定名・LINE名・本名の部分一致)または顧客番号で検索する。
// 各候補に紐づけできない理由を付けて返す(候補の自動選択はしない)。非表示の顧客は候補に含めない。
export async function searchCustomersForLinking(
  accountId: AccountId,
  contactId: string,
  query: string,
): Promise<{ ok: true; candidates: LinkCandidate[] } | { ok: false; error: string }> {
  await requireStaffAccount(accountId);
  if (!isUuid(contactId)) return { ok: false, error: "LINE送信者が正しく指定されていません。" };
  const normalized = normalizeSearchQuery(query);
  if (!normalized) {
    return { ok: false, error: "検索する名前を1〜50文字で入力してください。" };
  }

  const contact = await findContactForLinking(accountId, contactId);
  if (!contact) return { ok: false, error: "LINE送信者が見つかりません。" };

  // or()の文字列に入力値を埋め込まないよう、カラムごとに検索して結果をまとめる
  const pattern = toIlikePattern(normalized);
  const customerNo = parseCustomerNo(normalized);
  const queries = (["reading_name", "line_name", "real_name"] as const).map((column) =>
    supabaseServerClient
      .from("customers")
      .select(`${CUSTOMER_COLUMNS}, line_user_id, deleted_at`)
      .eq("account_id", accountId)
      .ilike(column, pattern)
      .is("deleted_at", null)
      .order("customer_no", { ascending: true })
      .limit(SEARCH_RESULT_LIMIT),
  );
  if (customerNo !== null) {
    queries.push(
      supabaseServerClient
        .from("customers")
        .select(`${CUSTOMER_COLUMNS}, line_user_id, deleted_at`)
        .eq("customer_no", customerNo)
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .limit(1),
    );
  }
  const results = await Promise.all(queries);
  const merged = new Map<string, CustomerRow & { line_user_id: string; deleted_at: string | null }>();
  for (const result of results) {
    if (result.error) {
      logError("search", result.error.code);
      return { ok: false, error: "検索に失敗しました。時間をおいて再度お試しください。" };
    }
    for (const row of result.data as (CustomerRow & { line_user_id: string; deleted_at: string | null })[]) {
      merged.set(row.id, row);
    }
  }
  const rows = [...merged.values()]
    .sort((a, b) => a.customer_no - b.customer_no)
    .slice(0, SEARCH_RESULT_LIMIT);

  const [ownerIds, linkedByCustomer] = await Promise.all([
    findLineUserIdOwnerCustomerIds(accountId, contact.lineUserId),
    findLinkedContactIdsByCustomer(accountId, rows.map((row) => row.id)),
  ]);

  return {
    ok: true,
    candidates: rows.map((row) => ({
      ...rowToLinkedCustomer(row),
      blockReason: getLinkBlockReason({
        contactId: contact.id,
        contactLineUserId: contact.lineUserId,
        customerId: row.id,
        customerLineUserId: row.line_user_id,
        customerHidden: row.deleted_at !== null,
        customerLinkedContactId: linkedByCustomer.get(row.id) ?? null,
        lineUserIdOwnerCustomerIds: ownerIds,
      }),
      lineUserIdMatches: row.line_user_id.trim() === contact.lineUserId,
    })),
  };
}

// LINE送信者を顧客へ紐づける。未紐づけの送信者のみ対象(紐づけ先の変更は、解除してから行う)
export async function linkLineContactToCustomer(
  accountId: AccountId,
  contactId: string,
  customerId: string,
): Promise<LineContactActionResult> {
  const { staff } = await requireStaffAccount(accountId);
  if (!isUuid(contactId) || !isUuid(customerId)) {
    return { ok: false, error: "LINE送信者または顧客が正しく指定されていません。" };
  }

  const contact = await findContactForLinking(accountId, contactId);
  if (!contact) return { ok: false, error: "LINE送信者が見つかりません。" };
  if (contact.customerId !== null) {
    return {
      ok: false,
      error:
        contact.customerId === customerId
          ? "既にこの顧客と紐づいています。"
          : "このLINE送信者は既に別の顧客と紐づいています。変更する場合は先に紐づけを解除してください。",
    };
  }

  const { data: customer, error: customerError } = await supabaseServerClient
    .from("customers")
    .select("id, line_user_id, deleted_at")
    .eq("id", customerId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (customerError) {
    logError("find_customer", customerError.code);
    return { ok: false, error: linkErrorMessageFromDbCode(undefined) };
  }
  if (!customer) {
    return { ok: false, error: "選択した顧客が見つかりません。画面を再読み込みしてください。" };
  }

  const [ownerIds, linkedByCustomer] = await Promise.all([
    findLineUserIdOwnerCustomerIds(accountId, contact.lineUserId),
    findLinkedContactIdsByCustomer(accountId, [customerId]),
  ]);
  const blockReason = getLinkBlockReason({
    contactId: contact.id,
    contactLineUserId: contact.lineUserId,
    customerId,
    customerLineUserId: customer.line_user_id ?? "",
    customerHidden: customer.deleted_at !== null,
    customerLinkedContactId: linkedByCustomer.get(customerId) ?? null,
    lineUserIdOwnerCustomerIds: ownerIds,
  });
  if (blockReason) return { ok: false, error: LINK_BLOCK_MESSAGES[blockReason] };

  // 未紐づけの場合のみ更新する(同時に別の操作で紐づけられていた場合は0件になる)。
  // 顧客の重複紐づけ・LINEユーザーIDの不一致はDB側(UNIQUEインデックス・トリガー)でも拒否される
  const { data, error } = await supabaseServerClient
    .from("line_contacts")
    .update({
      customer_id: customerId,
      linked_at: new Date().toISOString(),
      linked_by: staff.id,
    })
    .eq("id", contactId)
    .eq("account_id", accountId)
    .is("customer_id", null)
    .select("id");
  if (error) {
    logError("link", error.code);
    return { ok: false, error: linkErrorMessageFromDbCode(error.code) };
  }
  if (!data?.length) {
    return {
      ok: false,
      error: "他の操作で先に紐づけられた可能性があります。画面を再読み込みしてください。",
    };
  }
  return { ok: true };
}

// 紐づけを解除する(送信者を未紐づけに戻すだけで、会話履歴は変更・削除しない)。
// 画面に表示していた顧客と紐づいている場合のみ解除する(別の操作で変わっていたら何もしない)
export async function unlinkLineContact(
  accountId: AccountId,
  contactId: string,
  customerId: string,
): Promise<LineContactActionResult> {
  await requireStaffAccount(accountId);
  if (!isUuid(contactId) || !isUuid(customerId)) {
    return { ok: false, error: "LINE送信者または顧客が正しく指定されていません。" };
  }

  const { data, error } = await supabaseServerClient
    .from("line_contacts")
    .update({ customer_id: null, linked_at: null, linked_by: null })
    .eq("id", contactId)
    .eq("account_id", accountId)
    .eq("customer_id", customerId)
    .select("id");
  if (error) {
    logError("unlink", error.code);
    return { ok: false, error: "解除に失敗しました。時間をおいて再度お試しください。" };
  }
  if (!data?.length) {
    return {
      ok: false,
      error: "既に解除されたか、紐づけ先が変更されています。画面を再読み込みしてください。",
    };
  }
  return { ok: true };
}
