import Link from "next/link";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import {
  CONTACT_METHOD_LABELS,
  GENDER_LABELS,
  PARTNER_GENDER_LABELS,
  STATUS_LABELS,
} from "@/lib/freeReadingRequests/labels";
import { formatDate, formatDateTime } from "@/lib/format";

const CONTENT_PREVIEW_LENGTH = 40;

function previewContent(content: string): string {
  if (content.length <= CONTENT_PREVIEW_LENGTH) return content;
  return `${content.slice(0, CONTENT_PREVIEW_LENGTH)}…`;
}

function formatPartner(request: FreeReadingRequestListItem): string {
  if (!request.partnerName) return "-";
  const details = [
    request.partnerBirthDate ? formatDate(request.partnerBirthDate) : null,
    request.partnerGender
      ? (PARTNER_GENDER_LABELS[request.partnerGender] ?? request.partnerGender)
      : null,
  ]
    .filter(Boolean)
    .join("・");
  return details ? `${request.partnerName}（${details}）` : request.partnerName;
}

interface FreeReadingRequestTableProps {
  requests: FreeReadingRequestListItem[];
}

export function FreeReadingRequestTable({
  requests,
}: FreeReadingRequestTableProps) {
  if (requests.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500">
        無料鑑定の申込はまだありません。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              申込日
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              登録日時
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              ステータス
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              LINE表示名
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              生年月日
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              性別
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              お相手
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              鑑定方法
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              連絡先
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              今悩んでいること
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500">
              理想の未来
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {requests.map((request) => {
            const statusInfo = STATUS_LABELS[request.status] ?? {
              label: request.status,
              className: "bg-zinc-100 text-zinc-500",
            };
            const contactMethodInfo = CONTACT_METHOD_LABELS[
              request.contactMethod
            ] ?? {
              label: request.contactMethod,
              className: "bg-zinc-100 text-zinc-500",
            };

            return (
              <tr key={request.id} className="hover:bg-zinc-50">
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {request.applicationDate
                    ? formatDate(request.applicationDate)
                    : "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                  {formatDateTime(request.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                  >
                    {statusInfo.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  <Link
                    href={`/customers/free-reading-requests/${request.id}`}
                    className="text-violet-600 hover:text-violet-800"
                  >
                    {request.lineName || "-"}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {request.birthDate ? formatDate(request.birthDate) : "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {request.gender
                    ? (GENDER_LABELS[request.gender] ?? request.gender)
                    : "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {formatPartner(request)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${contactMethodInfo.className}`}
                  >
                    {contactMethodInfo.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {request.contactMethod === "instagram" &&
                  request.instagramUsername ? (
                    <a
                      href={`https://instagram.com/${request.instagramUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 hover:text-violet-800"
                    >
                      @{request.instagramUsername}
                    </a>
                  ) : request.contactMethod === "line" ? (
                    request.lineName || "-"
                  ) : (
                    "-"
                  )}
                </td>
                <td className="max-w-xs px-4 py-3 text-zinc-600">
                  {previewContent(request.content)}
                </td>
                <td className="max-w-xs px-4 py-3 text-zinc-600">
                  {request.idealFuture ? previewContent(request.idealFuture) : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
