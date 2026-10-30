"use client";

import { ConversationMessage } from "@/types/conversationMessage";
import { ConversationMessageItem } from "@/components/conversationMessages/ConversationMessageItem";

// LINEから自動保存した受信メッセージの確認用(閲覧のみ。編集・削除ボタンは手動登録の履歴にしか出ない)
function noop() {}

export function LineContactMessageList({ messages }: { messages: ConversationMessage[] }) {
  return (
    <section className="mt-10 border-t border-zinc-200 pt-6">
      <h2 className="text-sm font-semibold text-zinc-900">
        LINEの受信メッセージ（{messages.length}件）
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        紐づける顧客が正しいか、メッセージの内容で確認してください。
      </p>
      {messages.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          受信メッセージはありません。
        </p>
      ) : (
        <ul className="mt-3 space-y-2 rounded-md bg-zinc-50 p-2 sm:p-3">
          {messages.map((message) => (
            <ConversationMessageItem
              key={message.id}
              message={message}
              onEdit={noop}
              onDelete={noop}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
