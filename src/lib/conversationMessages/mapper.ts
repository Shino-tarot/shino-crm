import {
  ConversationDirection,
  ConversationMessage,
  ConversationSource,
} from "@/types/conversationMessage";

// 一覧取得で読み込むカラム(本文以外のLINE固有ID・操作者IDは画面で使わないため読まない)
export const CONVERSATION_MESSAGE_COLUMNS =
  "id, direction, source, message_type, body, sent_at, created_at, updated_at";

export interface ConversationMessageRow {
  id: string;
  direction: ConversationDirection;
  source: ConversationSource;
  message_type: string;
  body: string;
  sent_at: string;
  created_at: string;
  updated_at: string;
}

export function rowToConversationMessage(
  row: ConversationMessageRow,
): ConversationMessage {
  return {
    id: row.id,
    direction: row.direction,
    source: row.source,
    messageType: row.message_type,
    body: row.body,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface NormalizedConversationMessage {
  direction: ConversationDirection;
  body: string;
  // DB保存用のISO文字列(UTC)
  sentAt: string;
}

export function conversationMessageToRow(data: NormalizedConversationMessage) {
  return {
    direction: data.direction,
    body: data.body,
    sent_at: data.sentAt,
  };
}

// 送受信日時の古い順(チャットと同じ並び)。同時刻は登録順
export function compareConversationMessages(
  a: ConversationMessage,
  b: ConversationMessage,
): number {
  const diff = new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime();
  if (diff !== 0) return diff;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
