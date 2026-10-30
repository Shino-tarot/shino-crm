import Link from "next/link";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";
import { formatDate, formatDateTime } from "@/lib/format";

interface CustomerFreeReadingTabProps {
  customerId: string;
  customerHidden: boolean;
  requests: FreeReadingRequestListItem[];
}

// 顧客詳細の「無料鑑定申込」タブ。この顧客の申込(新しい順)を一覧にし、
// 詳細の確認・編集は従来の無料鑑定申込の詳細画面で行う(同じデータを参照する)。
export function CustomerFreeReadingTab({ customerId, customerHidden, requests }: CustomerFreeReadingTabProps) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">無料鑑定申込（{requests.length}件）</h2>
        {customerHidden ? (
          <span className="text-xs text-zinc-500">非表示中の顧客には追加できません</span>
        ) : (
          <Link
            href={`/customers/free-reading-requests/new?customerId=${customerId}`}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
          >
            + この顧客の無料鑑定を追加
          </Link>
        )}
      </div>

      {requests.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          この顧客の無料鑑定申込はまだありません。
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
          {requests.map((request) => {
            const status = STATUS_LABELS[request.status] ?? {
              label: request.status,
              className: "bg-zinc-100 text-zinc-500",
            };
            return (
              <li key={request.id}>
                <Link
                  href={`/customers/free-reading-requests/${request.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-900">
                      申込日：{request.applicationDate ? formatDate(request.applicationDate) : formatDateTime(request.createdAt)}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      {request.content || "（相談内容未入力）"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {request.sentAt && (
                      <span className="text-xs text-zinc-500">送信：{formatDateTime(request.sentAt)}</span>
                    )}
                    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
