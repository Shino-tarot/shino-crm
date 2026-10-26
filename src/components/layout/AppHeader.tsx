import Link from "next/link";
import { signOut } from "@/lib/auth/actions";

export function AppHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
        <Link href="/customers" className="text-lg font-semibold text-zinc-900">
          占い師CRM
        </Link>
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
