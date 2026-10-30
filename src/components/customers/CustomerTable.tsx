"use client";

import Link from "next/link";
import { Customer } from "@/types/customer";
import { formatDate, formatDateTime } from "@/lib/format";
import { CustomerListView } from "@/lib/customers/visibility";
import { CustomerOverview } from "@/lib/customers/overviewRules";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";

interface CustomerTableProps {
  customers: Customer[];
  // 最新ステータス・最終申込日・LINE連携(読み込み中はnull)
  overviews: Record<string, CustomerOverview> | null;
  view: CustomerListView;
  onHide: (customer: Customer) => void;
  onRestore: (customer: Customer) => void;
}

export function CustomerTable({ customers, overviews, view, onHide, onRestore }: CustomerTableProps) {
  if (customers.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500">
        {view === "hidden" ? "非表示の顧客はいません。" : "顧客がまだ登録されていません。"}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              顧客番号
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              名前
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              最新ステータス
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              最終申込日
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              LINE
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              年齢
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              性別
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              生年月日
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-500">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 text-zinc-500">
                No.{customer.customerNo}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/customers/${customer.id}`}
                  className="font-medium text-violet-600 hover:text-violet-800"
                >
                  {customer.readingName}
                </Link>
                {customer.lineName && (
                  <div className="text-xs text-zinc-400">
                    （LINE：{customer.lineName}）
                  </div>
                )}
                {customer.deletedAt && (
                  <div className="mt-1 text-xs text-zinc-500">
                    非表示にした日時：{formatDateTime(customer.deletedAt)}
                  </div>
                )}
              </td>
              <OverviewCells overview={overviews === null ? undefined : (overviews[customer.id] ?? null)} />
              <td className="px-4 py-3 text-zinc-600">
                {customer.age || "-"}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {customer.gender || "-"}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {formatDate(customer.birthday) || "-"}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  {customer.mergedIntoCustomerId ? (
                    <Link
                      href={`/customers/${customer.mergedIntoCustomerId}`}
                      className="text-zinc-500 hover:text-zinc-800"
                    >
                      統合済み（統合先を開く）
                    </Link>
                  ) : customer.deletedAt ? (
                    <button
                      type="button"
                      onClick={() => onRestore(customer)}
                      className="text-violet-600 hover:text-violet-800"
                    >
                      復元
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onHide(customer)}
                      className="text-zinc-500 hover:text-zinc-800"
                    >
                      非表示
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// undefined=読み込み中 / null=申込・LINE連携なし
function OverviewCells({ overview }: { overview: CustomerOverview | null | undefined }) {
  if (overview === undefined) {
    return (
      <td colSpan={3} className="px-4 py-3 text-xs text-zinc-400">
        読み込み中...
      </td>
    );
  }
  const status = overview?.latestStatus ? STATUS_LABELS[overview.latestStatus] : null;
  return (
    <>
      <td className="px-4 py-3">
        {status ? (
          <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">{overview?.latestStatus ?? "申込なし"}</span>
        )}
        {overview && overview.requestCount > 1 && (
          <span className="ml-1 text-xs text-zinc-400">（申込{overview.requestCount}件）</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
        {overview?.lastApplicationDate ? formatDate(overview.lastApplicationDate) : "-"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs">
        {overview?.lineLinked ? (
          <span className="text-emerald-700">連携済み</span>
        ) : (
          <span className="text-zinc-400">未連携</span>
        )}
      </td>
    </>
  );
}
