"use client";

import Link from "next/link";
import { Customer } from "@/types/customer";
import { formatDate } from "@/lib/format";

interface CustomerTableProps {
  customers: Customer[];
  onDelete: (customer: Customer) => void;
}

export function CustomerTable({ customers, onDelete }: CustomerTableProps) {
  if (customers.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500">
        顧客がまだ登録されていません。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              顧客ID
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              名前
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
              </td>
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
                  <button
                    type="button"
                    onClick={() => onDelete(customer)}
                    className="text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
