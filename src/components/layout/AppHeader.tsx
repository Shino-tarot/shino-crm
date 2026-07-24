import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/customers" className="text-lg font-semibold text-zinc-900">
          占い師CRM
        </Link>
        <nav className="flex gap-4 text-sm text-zinc-500">
          <Link href="/customers" className="hover:text-zinc-900">
            顧客管理
          </Link>
          <Link
            href="/customers/free-reading-requests"
            className="hover:text-zinc-900"
          >
            無料鑑定申込
          </Link>
        </nav>
      </div>
    </header>
  );
}
