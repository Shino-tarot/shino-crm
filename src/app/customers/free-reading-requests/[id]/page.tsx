import Link from "next/link";
import {
  getFreeReadingRequest,
  listFreeReadingRequestHistory,
} from "@/lib/freeReadingRequests/actions";
import {
  rowToHearingFormValues,
  rowToRequestListItem,
} from "@/lib/freeReadingRequests/mapper";
import { getCustomerSummary } from "@/lib/customers/summary";
import { listPaidReadings } from "@/lib/paidReadings/actions";
import { listUpsellPurchases } from "@/lib/upsellPurchases/actions";
import { listConversationMessages } from "@/lib/conversationMessages/actions";
import { getCurrentAccountId } from "@/lib/accounts/current";
import { HearingDetailClient } from "@/components/freeReadingRequests/HearingDetailClient";
import { syncAutoStatuses } from "@/lib/statusAutoUpdate/sync";
import { isScheduledSend } from "@/lib/statusAutoUpdate/rules";
import { CustomerSummary } from "@/types/customerSummary";
import { PaidReading } from "@/types/paidReading";
import { UpsellPurchase } from "@/types/upsellPurchase";
import { ConversationMessage } from "@/types/conversationMessage";

export const dynamic = "force-dynamic";

interface HearingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function HearingDetailPage({
  params,
}: HearingDetailPageProps) {
  const { id } = await params;
  const accountId = await getCurrentAccountId();
  // 申込取得の前にステータス自動更新を済ませる(レイアウトと同一リクエスト内では1回だけ実行される)
  await syncAutoStatuses();
  const row = await getFreeReadingRequest(accountId, id);

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
  const history = await listFreeReadingRequestHistory(accountId, row.line_name, id);

  const customerId = row.customer_id;
  let customerSummary: CustomerSummary | null = null;
  let paidReadings: PaidReading[] = [];
  let upsellPurchases: UpsellPurchase[] = [];
  let conversationMessages: ConversationMessage[] = [];

  if (customerId) {
    [customerSummary, paidReadings, upsellPurchases, conversationMessages] =
      await Promise.all([
        getCustomerSummary(accountId, customerId),
        listPaidReadings(accountId, customerId),
        listUpsellPurchases(accountId, customerId),
        listConversationMessages(accountId, customerId),
      ]);
  }

  const now = new Date();
  const sendScheduled =
    isScheduledSend(row.sent_at ?? null, now) ||
    paidReadings.some((reading) => isScheduledSend(reading.sentAt || null, now));

  return (
    <HearingDetailClient
      id={id}
      initialValues={formValues}
      createdAt={listItem.createdAt}
      history={history}
      customerId={customerId}
      customerHidden={listItem.customerHidden}
      linkedCustomer={
        listItem.customerNo === null
          ? null
          : { customerNo: listItem.customerNo, name: listItem.customerName, birthday: listItem.customerBirthday }
      }
      customerSummary={customerSummary}
      paidReadings={paidReadings}
      upsellPurchases={upsellPurchases}
      conversationMessages={conversationMessages}
      initialDetailRequest={
        row.detail_request === "yes" || row.detail_request === "no"
          ? row.detail_request
          : null
      }
      initialFollowedUpAt={row.followed_up_at ?? null}
      sendScheduled={sendScheduled}
    />
  );
}
