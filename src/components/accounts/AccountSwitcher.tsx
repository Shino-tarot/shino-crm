"use client";

import { useEffect, useState } from "react";
import { switchAccount } from "@/lib/accounts/actions";
import { ACCOUNTS, AccountId, accountLabel } from "@/lib/accounts/accounts";

// 他のタブへ切り替えを知らせるためのキー(値は切り替え先のアカウントと時刻のみ。個人情報は入れない)
const SWITCH_EVENT_KEY = "crm:account-switched";

// 他のタブへ切り替えを知らせる(保存できない環境ではプライベートモード等として省略する)
function notifyOtherTabs(next: AccountId) {
  try {
    window.localStorage.setItem(SWITCH_EVENT_KEY, `${next}:${Date.now()}`);
  } catch {
    // 他タブへの通知を省略する
  }
}

// 顧客一覧を開き直す(ページ全体を読み込み直し、画面内の一時データを捨てる)
function reopenCustomerList() {
  window.location.assign("/customers");
}

// ヘッダーのアカウント切り替え。切り替えたら顧客一覧を開き直す
// (別アカウントの顧客詳細のURLを開いたままにしない・画面内の一時データを捨てるため、ページ全体を読み込み直す)。
// 他のタブで切り替えられた場合は、このタブに「再読み込みしてください」と表示する
// (古いタブから保存しようとしても、サーバー側で照合して拒否される)。
export function AccountSwitcher({ accountId }: { accountId: AccountId }) {
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState("");
  const [switchedElsewhere, setSwitchedElsewhere] = useState<AccountId | null>(null);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== SWITCH_EVENT_KEY || !event.newValue) return;
      const next = event.newValue.split(":")[0];
      if (next !== accountId && ACCOUNTS.some((account) => account.id === next)) {
        setSwitchedElsewhere(next as AccountId);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [accountId]);

  async function handleSwitch(next: AccountId) {
    if (next === accountId || isSwitching) return;
    setIsSwitching(true);
    setError("");
    try {
      const result = await switchAccount(next);
      if (!result.ok) {
        setError(result.error);
        setIsSwitching(false);
        return;
      }
      notifyOtherTabs(next);
      reopenCustomerList();
    } catch {
      setError("切り替えに失敗しました。");
      setIsSwitching(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1 rounded-md border border-zinc-200 p-0.5" role="group" aria-label="アカウントの切り替え">
        {ACCOUNTS.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => handleSwitch(account.id)}
            disabled={isSwitching}
            aria-pressed={account.id === accountId}
            className={`rounded px-3 py-1 text-xs font-medium disabled:opacity-60 ${
              account.id === accountId ? account.bannerClassName : "text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            {account.label}
          </button>
        ))}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {switchedElsewhere && (
        <div className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-white">
          別のタブでアカウントが「{accountLabel(switchedElsewhere)}」に切り替えられました。この画面は「{accountLabel(accountId)}」のままのため、保存はできません。
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-white px-3 py-1 text-xs font-bold text-amber-700"
          >
            再読み込み
          </button>
        </div>
      )}
    </>
  );
}
