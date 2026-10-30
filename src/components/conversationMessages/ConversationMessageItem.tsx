"use client";

import { useState } from "react";
import { ConversationMessage } from "@/types/conversationMessage";
import { formatDateTime } from "@/lib/format";
import { CopyButton } from "@/components/ui/CopyButton";

interface ConversationMessageItemProps {
  message: ConversationMessage;
  onEdit: () => void;
  onDelete: () => void;
}

// これより長い本文は折りたたんで表示する(スマホで画面が埋まらないように)
const COLLAPSE_LENGTH = 200;

// 受信はLINEと同じく左寄せ、送信は右寄せの吹き出しで表示する
export function ConversationMessageItem({
  message,
  onEdit,
  onDelete,
}: ConversationMessageItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isOutgoing = message.direction === "outgoing";
  const isManual = message.source === "manual";
  const isLong = message.body.length > COLLAPSE_LENGTH;
  const visibleBody =
    isLong && !isExpanded
      ? `${message.body.slice(0, COLLAPSE_LENGTH)}…`
      : message.body;

  return (
    <li className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}>
      <div
        className={`w-full max-w-[88%] rounded-lg border p-3 sm:max-w-[75%] ${
          isOutgoing
            ? "border-violet-200 bg-violet-50"
            : "border-zinc-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className={`font-semibold ${isOutgoing ? "text-violet-700" : "text-zinc-700"}`}
          >
            {isOutgoing ? "送信（鯛子から）" : "受信（お客様から）"}
          </span>
          <span className="text-zinc-500">{formatDateTime(message.sentAt)}</span>
          <span
            className={`rounded-full px-2 py-0.5 ${
              isManual ? "bg-zinc-100 text-zinc-500" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isManual ? "手動登録" : "LINE自動保存"}
          </span>
        </div>

        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-900">
          {visibleBody}
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          {isLong && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="mr-auto text-xs font-medium text-violet-600 hover:text-violet-800"
            >
              {isExpanded ? "折りたたむ" : "全文を見る"}
            </button>
          )}
          <CopyButton text={message.body} label="コピー" />
          {isManual && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                編集
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                削除
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
