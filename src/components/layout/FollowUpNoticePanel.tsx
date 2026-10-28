import Link from "next/link";
import type { FollowUpNotice, FollowUpNotices } from "@/lib/followUp/notices";
import { formatDateTime } from "@/lib/format";

function NoticeList({ notices }: { notices: FollowUpNotice[] }) {
  return (
    <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
      {notices.map((notice) => (
        <li key={notice.id}>
          <Link
            href={`/customers/free-reading-requests/${notice.id}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm hover:bg-zinc-50"
          >
            <span className="font-medium text-violet-600">
              {notice.name || notice.lineName || "（未入力）"}
              {notice.name && notice.lineName && (
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  LINE: {notice.lineName}
                </span>
              )}
            </span>
            <span className="text-xs text-zinc-500">
              無料鑑定送信: {formatDateTime(notice.sentAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// 無料鑑定送信24時間後のフォロー通知(CRM内表示のみ)。
// 機能導入前から対象だった申込は「過去分の確認」として分け、通知件数には含めない。
// 詳細希望の回答・フォロー済みにすると、次の画面表示から一覧から消える。
export function FollowUpNoticePanel({ newNotices, pastNotices }: FollowUpNotices) {
  if (newNotices.length === 0 && pastNotices.length === 0) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-2 px-6 pt-4">
      {newNotices.length > 0 && (
        <details open className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-rose-800">
            フォロー通知
            <span className="ml-2 inline-block rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
              {newNotices.length}件
            </span>
            <span className="ml-2 text-xs font-normal text-rose-700">
              無料鑑定送信から24時間経過・詳細希望が未回答のお客様
            </span>
          </summary>
          <NoticeList notices={newNotices} />
        </details>
      )}
      {pastNotices.length > 0 && (
        <details className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2">
          <summary className="cursor-pointer text-xs text-zinc-600">
            過去分の確認（{pastNotices.length}件・機能導入前から対象だった申込）
          </summary>
          <NoticeList notices={pastNotices} />
        </details>
      )}
    </div>
  );
}
