import { ConversationMessageFormValues } from "@/types/conversationMessage";
import { fromJstDateTimeLocal } from "@/lib/format";
import { NormalizedConversationMessage } from "@/lib/conversationMessages/mapper";

// LINEのテキストメッセージ上限(5000文字)より余裕を持たせ、長い鑑定文の貼り付けも許容する
export const BODY_MAX_LENGTH = 10000;
// 端末の時計のずれを考慮し、少しだけ未来の日時は許容する
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DIRECTIONS = ["incoming", "outgoing"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export type ConversationMessageValidationResult =
  | { valid: true; data: NormalizedConversationMessage }
  | { valid: false; errors: Record<string, string> };

// Server Actionは外部から任意の値で直接呼び出せるため、型どおりの値が届く前提にしない
export function validateConversationMessageForm(
  values: ConversationMessageFormValues,
  now: Date = new Date(),
): ConversationMessageValidationResult {
  const errors: Record<string, string> = {};
  const input = (values ?? {}) as Partial<Record<keyof ConversationMessageFormValues, unknown>>;

  const direction = input.direction;
  if (!DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])) {
    errors.direction = "受信・送信のどちらかを選んでください。";
  }

  const sentAtInput = typeof input.sentAt === "string" ? input.sentAt.trim() : "";
  let sentAt: string | null = null;
  if (!sentAtInput) {
    errors.sentAt = "送受信日時を入力してください。";
  } else if (
    !DATETIME_LOCAL_PATTERN.test(sentAtInput) ||
    !(sentAt = fromJstDateTimeLocal(sentAtInput))
  ) {
    errors.sentAt = "送受信日時の形式が正しくありません。";
  } else if (new Date(sentAt).getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.sentAt = "未来の日時は登録できません。";
  }

  // NUL文字はDB(text型)に保存できないため取り除く。前後の空白・改行のみ除去し、本文中の改行は保持する
  const body =
    typeof input.body === "string" ? input.body.replace(/\u0000/g, "").trim() : "";
  if (!body) {
    errors.body = "本文を入力してください。";
  } else if (body.length > BODY_MAX_LENGTH) {
    errors.body = `本文は${BODY_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      direction: direction as NormalizedConversationMessage["direction"],
      body,
      sentAt: sentAt as string,
    },
  };
}
