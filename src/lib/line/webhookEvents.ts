// LINE Messaging APIのWebhookイベントを、会話履歴(conversation_messages)へ保存する形に変換する。
// DBアクセスを含まない純粋な関数のみ。
// 参考: https://developers.line.biz/ja/reference/messaging-api/#webhook-event-objects

export interface LineWebhookBody {
  destination?: string;
  events: unknown[];
}

const LINE_USER_ID_PATTERN = /^U[0-9a-f]{32}$/;

// conversation_messages.message_type のCHECK制約と同じ値
export type StoredMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "location"
  | "sticker"
  | "other";

// テキスト以外は内容(画像・位置情報・ファイル名など)を保存せず、種類と説明文だけを保存する
const NON_TEXT_DESCRIPTIONS: Record<Exclude<StoredMessageType, "text">, string> = {
  image: "画像が届きました",
  video: "動画が届きました",
  audio: "音声メッセージが届きました",
  file: "ファイルが届きました",
  location: "位置情報が届きました",
  sticker: "スタンプが届きました",
  other: "その他のメッセージが届きました",
};

export interface IncomingMessageRecord {
  lineUserId: string;
  webhookEventId: string;
  lineMessageId: string | null;
  messageType: StoredMessageType;
  body: string;
  // ISO文字列(UTC)
  sentAt: string;
}

export type FriendStatusChange = {
  lineUserId: string;
  friendStatus: "friend" | "blocked";
  occurredAt: string;
};

export type ParsedLineEvent =
  | { kind: "message"; record: IncomingMessageRecord }
  | { kind: "friend_status"; change: FriendStatusChange }
  | { kind: "ignored"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// JSONとして正しく、events配列を持つ場合のみ受け付ける
export function parseWebhookBody(text: string): LineWebhookBody | null {
  try {
    const json: unknown = JSON.parse(text);
    if (!isRecord(json) || !Array.isArray(json.events)) return null;
    return {
      destination: typeof json.destination === "string" ? json.destination : undefined,
      events: json.events,
    };
  } catch {
    return null;
  }
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toStoredMessageType(type: unknown): StoredMessageType {
  switch (type) {
    case "text":
    case "image":
    case "video":
    case "audio":
    case "file":
    case "location":
    case "sticker":
      return type;
    default:
      return "other";
  }
}

export function parseLineEvent(event: unknown): ParsedLineEvent {
  if (!isRecord(event)) return { kind: "ignored", reason: "invalid_event" };

  // 1対1のトーク(source.type='user')のみ対象。グループ・複数人トークは保存しない
  const source = isRecord(event.source) ? event.source : null;
  const lineUserId = source?.type === "user" ? source.userId : undefined;
  if (typeof lineUserId !== "string" || !LINE_USER_ID_PATTERN.test(lineUserId)) {
    return { kind: "ignored", reason: "not_user_source" };
  }

  const occurredAt = toIsoTimestamp(event.timestamp);
  if (!occurredAt) return { kind: "ignored", reason: "invalid_timestamp" };

  if (event.type === "follow" || event.type === "unfollow") {
    return {
      kind: "friend_status",
      change: {
        lineUserId,
        friendStatus: event.type === "follow" ? "friend" : "blocked",
        occurredAt,
      },
    };
  }

  if (event.type !== "message") {
    return { kind: "ignored", reason: "unsupported_event_type" };
  }

  const webhookEventId = event.webhookEventId;
  if (typeof webhookEventId !== "string" || webhookEventId === "") {
    // 二重保存防止のキーが無いイベントは保存しない
    return { kind: "ignored", reason: "missing_webhook_event_id" };
  }

  const message = isRecord(event.message) ? event.message : null;
  if (!message) return { kind: "ignored", reason: "missing_message" };

  const messageType = toStoredMessageType(message.type);
  let body: string;
  if (messageType === "text") {
    // NUL文字はDB(text型)に保存できないため取り除く
    body = typeof message.text === "string" ? message.text.replace(/\u0000/g, "") : "";
  } else {
    body = NON_TEXT_DESCRIPTIONS[messageType];
  }

  return {
    kind: "message",
    record: {
      lineUserId,
      webhookEventId,
      lineMessageId: typeof message.id === "string" ? message.id : null,
      messageType,
      body,
      sentAt: occurredAt,
    },
  };
}
