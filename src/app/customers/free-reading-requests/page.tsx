import Link from "next/link";
import { listFreeReadingRequests } from "@/lib/freeReadingRequests/actions";
import { FreeReadingRequestListView } from "@/components/freeReadingRequests/FreeReadingRequestListView";
import { getCurrentAccountId } from "@/lib/accounts/current";
import { syncAutoStatuses } from "@/lib/statusAutoUpdate/sync";
import { listScheduledPaidReadingCustomerIds } from "@/lib/statusAutoUpdate/scheduled";
import { isScheduledSend } from "@/lib/statusAutoUpdate/rules";

export const dynamic = "force-dynamic";

interface FreeReadingRequestsPageProps {
  searchParams: Promise<{ deleted?: string }>;
}

export default async function FreeReadingRequestsPage({
  searchParams,
}: FreeReadingRequestsPageProps) {
  // 一覧取得の前にステータス自動更新を済ませる(レイアウトと同一リクエスト内では1回だけ実行される)
  await syncAutoStatuses();
  const accountId = await getCurrentAccountId();
  const [rawRequests, scheduledPaidCustomerIds, { deleted }] = await Promise.all([
    listFreeReadingRequests(accountId),
    listScheduledPaidReadingCustomerIds(),
    searchParams,
  ]);
  const now = new Date();
  const requests = rawRequests.map((request) => ({
    ...request,
    sendScheduled:
      isScheduledSend(request.sentAt, now) ||
      (request.customerId !== null &&
        scheduledPaidCustomerIds.has(request.customerId)),
  }));

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

      {deleted === "1" && (
        <p className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          削除しました。
        </p>
      )}

      <p className="mb-4 text-sm text-zinc-500">全{requests.length}件</p>

      <FreeReadingRequestListView requests={requests} />
    </div>
  );
}
