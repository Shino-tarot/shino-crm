import Link from "next/link";
import { listLineContacts } from "@/lib/lineContacts/actions";
import { displayNameOrFallback, formatCustomerLabel } from "@/lib/lineContacts/rules";
import { formatDateTime } from "@/lib/format";
import { getCurrentAccountId } from "@/lib/accounts/current";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "unlinked", label: "未紐づけ" },
  { key: "linked", label: "紐づけ済み" },
  { key: "all", label: "すべて" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

interface LineContactsPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function LineContactsPage({ searchParams }: LineContactsPageProps) {
  const accountId = await getCurrentAccountId();
  const [contacts, { view: rawView }] = await Promise.all([listLineContacts(accountId), searchParams]);
  const view: ViewKey = VIEWS.some((v) => v.key === rawView) ? (rawView as ViewKey) : "unlinked";

  const unlinkedCount = contacts.filter((c) => c.customer === null).length;
  const visible = contacts.filter((c) =>
    view === "all" ? true : view === "linked" ? c.customer !== null : c.customer === null,
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">LINE送信者の紐づけ</h1>
      <p className="mt-1 text-sm text-zinc-500">
        LINEからメッセージを送ってきた相手を、CRMの顧客と紐づけます。紐づけると、その顧客の会話履歴にLINEの受信メッセージが表示されます。
      </p>

      <nav className="mt-6 flex gap-2 border-b border-zinc-200">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "unlinked" ? "/customers/line-contacts" : `/customers/line-contacts?view=${v.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              view === v.key
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {v.label}
            {v.key === "unlinked" && unlinkedCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                {unlinkedCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <p className="mt-4 mb-3 text-sm text-zinc-500">全{visible.length}件</p>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          {view === "unlinked" ? "未紐づけのLINE送信者はいません。" : "該当するLINE送信者はいません。"}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
          {visible.map((contact) => (
            <li key={contact.id}>
              <Link
                href={`/customers/line-contacts/${contact.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-medium ${
                      contact.displayName.trim() ? "text-zinc-900" : "text-zinc-400"
                    }`}
                  >
                    {displayNameOrFallback(contact.displayName)}
                    {contact.friendStatus === "blocked" && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                        ブロック中
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    最終受信：{contact.lastMessageAt ? formatDateTime(contact.lastMessageAt) : "なし"}
                    <span className="ml-3">受信 {contact.messageCount}件</span>
                  </p>
                </div>
                {contact.customer ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    紐づけ済み：{formatCustomerLabel(contact.customer)}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                    未紐づけ
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
