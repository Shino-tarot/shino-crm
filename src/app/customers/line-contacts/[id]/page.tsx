import Link from "next/link";
import { notFound } from "next/navigation";
import { getLineContactDetail } from "@/lib/lineContacts/actions";
import { displayNameOrFallback } from "@/lib/lineContacts/rules";
import { formatDateTime } from "@/lib/format";
import { getCurrentAccountId } from "@/lib/accounts/current";
import { LineContactLinkPanel } from "@/components/lineContacts/LineContactLinkPanel";
import { LineContactMessageList } from "@/components/lineContacts/LineContactMessageList";

export const dynamic = "force-dynamic";

const FRIEND_STATUS_LABELS = {
  friend: "友だち",
  blocked: "ブロック中",
  unknown: "不明",
} as const;

export default async function LineContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = await getCurrentAccountId();
  const detail = await getLineContactDetail(accountId, id);
  if (!detail) notFound();
  const { contact, messages } = detail;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/customers/line-contacts" className="text-sm text-violet-600 hover:text-violet-800">
        ← LINE送信者一覧へ戻る
      </Link>

      <h1
        className={`mt-4 text-xl font-semibold ${
          contact.displayName.trim() ? "text-zinc-900" : "text-zinc-400"
        }`}
      >
        {displayNameOrFallback(contact.displayName)}
      </h1>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-500">最終受信</dt>
        <dd className="text-zinc-900">
          {contact.lastMessageAt ? formatDateTime(contact.lastMessageAt) : "なし"}
        </dd>
        <dt className="text-zinc-500">友だち状態</dt>
        <dd className="text-zinc-900">{FRIEND_STATUS_LABELS[contact.friendStatus]}</dd>
        <dt className="text-zinc-500">初回受信</dt>
        <dd className="text-zinc-900">{formatDateTime(contact.createdAt)}</dd>
      </dl>

      <LineContactLinkPanel
        contactId={contact.id}
        contactName={displayNameOrFallback(contact.displayName)}
        customer={contact.customer}
        linkedAt={contact.linkedAt}
      />

      <LineContactMessageList messages={messages} />
    </div>
  );
}
