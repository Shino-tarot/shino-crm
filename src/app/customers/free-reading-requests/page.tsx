import { listFreeReadingRequests } from "@/lib/freeReadingRequests/actions";
import { FreeReadingRequestTable } from "@/components/freeReadingRequests/FreeReadingRequestTable";

export const dynamic = "force-dynamic";

export default async function FreeReadingRequestsPage() {
  const requests = await listFreeReadingRequests();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">無料鑑定申込一覧</h1>
        <p className="text-sm text-zinc-500">全{requests.length}件</p>
      </div>

      <FreeReadingRequestTable requests={requests} />
    </div>
  );
}
