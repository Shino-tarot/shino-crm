"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import {
  ConversationMessage,
  ConversationMessageFormValues,
} from "@/types/conversationMessage";
import {
  createConversationMessage,
  deleteConversationMessage,
  updateConversationMessage,
} from "@/lib/conversationMessages/actions";
import { formatDateTime, toDateTimeLocalInput } from "@/lib/format";
import { ConversationMessageItem } from "@/components/conversationMessages/ConversationMessageItem";
import { ConversationMessageFormModal } from "@/components/conversationMessages/ConversationMessageFormModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAccountId } from "@/components/accounts/AccountProvider";

interface ConversationSectionProps {
  customerId: string;
  messages: ConversationMessage[];
}

// 最初は直近の件数だけ表示し、それより前は「以前の履歴を表示」で展開する
const INITIAL_VISIBLE_COUNT = 30;

// 日本時間の日付("YYYY-MM-DD")。日付の区切り線を出すために使う
function toJstDateKey(value: string): string {
  return toDateTimeLocalInput(value).slice(0, 10);
}

function formatDateKey(key: string): string {
  const [year, month, day] = key.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

// 保存・削除の成否に応じてrouter.refresh()でサーバーの最新データを再取得する(PaidReadingSectionと同じ方式)。
export function ConversationSection({
  customerId,
  messages,
}: ConversationSectionProps) {
  const accountId = useAccountId();
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ConversationMessage | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<ConversationMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const hiddenCount = showAll
    ? 0
    : Math.max(0, messages.length - INITIAL_VISIBLE_COUNT);
  const visibleMessages = messages.slice(hiddenCount);

  function openCreateForm() {
    setEditingTarget(null);
    setIsFormOpen(true);
  }

  function openEditForm(message: ConversationMessage) {
    setEditingTarget(message);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingTarget(null);
  }

  async function handleSubmit(values: ConversationMessageFormValues) {
    const result = editingTarget
      ? await updateConversationMessage(accountId, editingTarget.id, values)
      : await createConversationMessage(accountId, customerId, values);
    if (result.ok) {
      closeForm();
      router.refresh();
    }
    return result;
  }

  async function handleConfirmDelete() {
    if (!deletingTarget) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteConversationMessage(accountId, deletingTarget.id);
      setDeletingTarget(null);
      router.refresh();
    } catch {
      setDeleteError("削除に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">
          会話履歴（{messages.length}件）
        </h2>
        <button
          type="button"
          onClick={openCreateForm}
          className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
        >
          + 手動登録
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        LINE公式アプリでやり取りしたメッセージをコピーして登録できます。
        LINEの受信メッセージは、
        <Link href="/customers/line-contacts" className="text-violet-600 hover:text-violet-800">
          LINE紐づけ
        </Link>
        でこの顧客と紐づけると表示されます。
      </p>

      {messages.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          会話履歴はまだありません。
        </p>
      ) : (
        <div className="mt-3 rounded-md bg-zinc-50 p-2 sm:p-3">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mb-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              以前の履歴を表示（{hiddenCount}件）
            </button>
          )}
          <ul className="space-y-2">
            {visibleMessages.map((message, index) => {
              const dateKey = toJstDateKey(message.sentAt);
              const previous = visibleMessages[index - 1];
              const isNewDate = !previous || toJstDateKey(previous.sentAt) !== dateKey;
              return (
                <ConversationMessageGroup
                  key={message.id}
                  dateLabel={isNewDate ? formatDateKey(dateKey) : null}
                >
                  <ConversationMessageItem
                    message={message}
                    onEdit={() => openEditForm(message)}
                    onDelete={() => {
                      setDeleteError("");
                      setDeletingTarget(message);
                    }}
                  />
                </ConversationMessageGroup>
              );
            })}
          </ul>
        </div>
      )}
      {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}

      {isFormOpen && (
        <ConversationMessageFormModal
          target={editingTarget}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}

      {deletingTarget && (
        <ConfirmDialog
          title="会話履歴の削除"
          message={
            <>
              {formatDateTime(deletingTarget.sentAt)}の
              {deletingTarget.direction === "outgoing" ? "送信" : "受信"}
              メッセージを削除します。
              <br />
              この操作は取り消せません。よろしいですか？
            </>
          }
          confirmLabel="削除する"
          confirmingLabel="削除中..."
          isConfirming={isDeleting}
          onCancel={() => setDeletingTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </section>
  );
}

function ConversationMessageGroup({
  dateLabel,
  children,
}: {
  dateLabel: string | null;
  children: ReactNode;
}) {
  if (!dateLabel) return <>{children}</>;
  return (
    <>
      <li aria-hidden="true" className="flex items-center gap-2 py-1">
        <span className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-400">{dateLabel}</span>
        <span className="h-px flex-1 bg-zinc-200" />
      </li>
      {children}
    </>
  );
}
