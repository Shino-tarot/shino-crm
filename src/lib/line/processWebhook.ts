import {
  FriendStatusChange,
  IncomingMessageRecord,
  parseLineEvent,
} from "@/lib/line/webhookEvents";

// DBへの保存処理(テストでは差し替えられるようにインターフェースで受け取る)
export interface LineWebhookStore {
  // LINEの相手を取得、無ければ未紐づけ(customer_id=NULL)で作成し、idを返す
  ensureContact(lineUserId: string, lastMessageAt: string | null): Promise<string>;
  // 保存した場合は"inserted"、同じWebhookイベントが保存済みなら"duplicate"
  insertIncomingMessage(
    contactId: string,
    record: IncomingMessageRecord,
  ): Promise<"inserted" | "duplicate">;
  updateFriendStatus(change: FriendStatusChange): Promise<void>;
}

export interface ProcessSummary {
  inserted: number;
  duplicate: number;
  friendStatus: number;
  ignored: number;
}

// イベントを1件ずつ順番に処理する(同じ相手の連続メッセージで相手の作成が競合しないように)。
// 保存に失敗した場合は例外を投げ、呼び出し側で500を返してLINEに再送してもらう
// (再送されても保存済みのイベントはwebhookEventIdで重複として扱われる)。
export async function processLineWebhookEvents(
  events: unknown[],
  store: LineWebhookStore,
): Promise<ProcessSummary> {
  const summary: ProcessSummary = { inserted: 0, duplicate: 0, friendStatus: 0, ignored: 0 };

  for (const event of events) {
    const parsed = parseLineEvent(event);

    if (parsed.kind === "message") {
      const contactId = await store.ensureContact(
        parsed.record.lineUserId,
        parsed.record.sentAt,
      );
      const result = await store.insertIncomingMessage(contactId, parsed.record);
      summary[result] += 1;
    } else if (parsed.kind === "friend_status") {
      await store.ensureContact(parsed.change.lineUserId, null);
      await store.updateFriendStatus(parsed.change);
      summary.friendStatus += 1;
    } else {
      summary.ignored += 1;
    }
  }

  return summary;
}
