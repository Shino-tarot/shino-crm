"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  linkLineContactToCustomer,
  searchCustomersForLinking,
  unlinkLineContact,
} from "@/lib/lineContacts/actions";
import {
  LINK_BLOCK_MESSAGES,
  SEARCH_QUERY_MAX_LENGTH,
  formatCustomerLabel,
} from "@/lib/lineContacts/rules";
import { formatDateTime } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LinkCandidate, LinkedCustomer } from "@/types/lineContact";
import { useAccountId } from "@/components/accounts/AccountProvider";

interface LineContactLinkPanelProps {
  contactId: string;
  contactName: string;
  customer: LinkedCustomer | null;
  linkedAt: string | null;
}

const UNEXPECTED_ERROR = "処理に失敗しました。時間をおいて再度お試しください。";

// 顧客の検索 → 選択 → 確認ダイアログ → 保存、の順でのみ紐づける(自動選択はしない)。
// 保存・解除後はrouter.refresh()でサーバーの最新データを再取得する(PaidReadingSectionと同じ方式)。
export function LineContactLinkPanel({
  contactId,
  contactName,
  customer,
  linkedAt,
}: LineContactLinkPanelProps) {
  const accountId = useAccountId();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<LinkCandidate | null>(null);
  const [isUnlinkOpen, setIsUnlinkOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setIsSearching(true);
    try {
      const result = await searchCustomersForLinking(accountId, contactId, query);
      if (result.ok) {
        setCandidates(result.candidates);
      } else {
        setCandidates(null);
        setError(result.error);
      }
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleConfirmLink() {
    if (!selected) return;
    setIsSaving(true);
    setError("");
    try {
      const result = await linkLineContactToCustomer(accountId, contactId, selected.id);
      if (result.ok) {
        setSelected(null);
        setCandidates(null);
        setQuery("");
        setNotice("紐づけました。");
        router.refresh();
      } else {
        setSelected(null);
        setError(result.error);
      }
    } catch {
      setSelected(null);
      setError(UNEXPECTED_ERROR);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmUnlink() {
    if (!customer) return;
    setIsSaving(true);
    setError("");
    try {
      const result = await unlinkLineContact(accountId, contactId, customer.id);
      setIsUnlinkOpen(false);
      if (result.ok) {
        setNotice("紐づけを解除しました。会話履歴はそのまま残っています。");
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setIsUnlinkOpen(false);
      setError(UNEXPECTED_ERROR);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">顧客との紐づけ</h2>

      {notice && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {customer ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p>
              <span className="text-zinc-500">紐づけ先：</span>
              <Link
                href={`/customers/${customer.id}`}
                className="font-medium text-violet-700 hover:text-violet-900"
              >
                {formatCustomerLabel(customer)}
              </Link>
            </p>
            {linkedAt && (
              <p className="mt-0.5 text-xs text-zinc-500">紐づけ日時：{formatDateTime(linkedAt)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice("");
              setIsUnlinkOpen(true);
            }}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            紐づけを解除
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs text-zinc-500">
            顧客を名前（鑑定名・LINE名・本名）または顧客番号で検索し、選んでください。表示名が同じでも別人の場合があるため、受信メッセージの内容で確認してから紐づけてください。
          </p>
          <form onSubmit={handleSearch} className="mt-3 flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={SEARCH_QUERY_MAX_LENGTH}
              placeholder="顧客の名前で検索"
              aria-label="顧客の名前で検索"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSearching || query.trim() === ""}
              className="shrink-0 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {isSearching ? "検索中..." : "検索"}
            </button>
          </form>

          {candidates !== null &&
            (candidates.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">該当する顧客が見つかりませんでした。</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200">
                {candidates.map((candidate) => (
                  <li
                    key={candidate.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-zinc-900">
                        {formatCustomerLabel(candidate)}
                        {candidate.lineUserIdMatches && (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            LINE User ID一致
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">
                        LINE名：{candidate.lineName || "—"} ／ 本名：{candidate.realName || "—"}
                      </p>
                      {candidate.blockReason && (
                        <p className="mt-0.5 text-xs text-red-600">
                          {LINK_BLOCK_MESSAGES[candidate.blockReason]}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={candidate.blockReason !== null}
                      onClick={() => {
                        setError("");
                        setSelected(candidate);
                      }}
                      className="shrink-0 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      この顧客に紐づける
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}

      {selected && (
        <ConfirmDialog
          title="顧客との紐づけ"
          message={
            <>
              LINE送信者「{contactName}」を、顧客「{formatCustomerLabel(selected)}」に紐づけます。
              <br />
              紐づけると、この顧客の会話履歴にLINEの受信メッセージが表示されます。よろしいですか？
            </>
          }
          confirmLabel="紐づける"
          confirmingLabel="保存中..."
          isConfirming={isSaving}
          onCancel={() => setSelected(null)}
          onConfirm={handleConfirmLink}
        />
      )}

      {isUnlinkOpen && customer && (
        <ConfirmDialog
          title="紐づけの解除"
          message={
            <>
              LINE送信者「{contactName}」と顧客「{formatCustomerLabel(customer)}」の紐づけを解除します。
              <br />
              会話履歴は削除されず、未紐づけの状態に戻ります。よろしいですか？
            </>
          }
          confirmLabel="解除する"
          confirmingLabel="解除中..."
          isConfirming={isSaving}
          onCancel={() => setIsUnlinkOpen(false)}
          onConfirm={handleConfirmUnlink}
        />
      )}
    </section>
  );
}
