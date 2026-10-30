import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { AccountId, getAccount } from "@/lib/accounts/accounts";
import { AccountSwitcher } from "@/components/accounts/AccountSwitcher";

export function AppHeader({ accountId }: { accountId: AccountId }) {
  const account = getAccount(accountId);
  return (
    <header className="border-b border-zinc-200 bg-white">
      {/* 表示中のアカウントの色帯(どのアカウントのデータを見ているか、常に分かるようにする) */}
      <div className={`px-6 py-1 text-center text-xs font-bold ${account.bannerClassName}`}>
        {account.label}のCRMを表示中
      </div>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/customers" className="text-lg font-semibold text-zinc-900">
            占い師CRM
          </Link>
          <AccountSwitcher accountId={accountId} />
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500">
          <Link href="/customers" className="hover:text-zinc-900">
            顧客管理
          </Link>
          <Link
            href="/customers/free-reading-requests"
            className="hover:text-zinc-900"
          >
            無料鑑定申込
          </Link>
          <Link href="/customers/line-contacts" className="hover:text-zinc-900">
            LINE紐づけ
          </Link>
          <form action={signOut}>
            <button type="submit" className="hover:text-zinc-900">
              ログアウト
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
