import Link from "next/link";
import { getFreeReadingRequest } from "@/lib/freeReadingRequests/actions";
import {
  rowToHearingFormValues,
  rowToRequestListItem,
} from "@/lib/freeReadingRequests/mapper";
import { HearingDetailClient } from "@/components/freeReadingRequests/HearingDetailClient";

export const dynamic = "force-dynamic";

interface HearingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function HearingDetailPage({
  params,
}: HearingDetailPageProps) {
  const { id } = await params;
  const row = await getFreeReadingRequest(id);

  if (!row) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-sm text-zinc-500">申込データが見つかりませんでした。</p>
        <Link
          href="/customers/free-reading-requests"
          className="mt-4 inline-block text-sm text-violet-600 hover:text-violet-800"
        >
          ← 無料鑑定申込一覧に戻る
        </Link>
      </div>
    );
  }

  const listItem = rowToRequestListItem(row);
  const formValues = rowToHearingFormValues(row);

  return (
    <HearingDetailClient
      id={id}
      initialValues={formValues}
      createdAt={listItem.createdAt}
    />
  );
}
