import Link from "next/link";
import { listFreeReadingRequests } from "@/lib/freeReadingRequests/actions";
import { FreeReadingRequestTable } from "@/components/freeReadingRequests/FreeReadingRequestTable";

export const dynamic = "force-dynamic";

export default async function FreeReadingRequestsPage() {
  const requests = await listFreeReadingRequests();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">無料鑑定申込一覧</h1>
        <Link
          href="/customers/free-reading-requests/new"
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          + 新規登録
        </Link>
      </div>
      <p className="mb-4 text-sm text-zinc-500">全{requests.length}件</p>

      <FreeReadingRequestTable requests={requests} />
    </div>
  );
}
