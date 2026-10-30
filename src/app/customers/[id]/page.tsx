import { listConversationMessages } from "@/lib/conversationMessages/actions";
import { listCustomerFreeReadingRequests } from "@/lib/freeReadingRequests/actions";
import { listPaidReadings } from "@/lib/paidReadings/actions";
import { listUpsellPurchases } from "@/lib/upsellPurchases/actions";
import { getCustomerSummary } from "@/lib/customers/summary";
import { getCurrentAccountId } from "@/lib/accounts/current";
import { CustomerDetailClient, CustomerDetailData } from "@/components/customers/CustomerDetailClient";

export const dynamic = "force-dynamic";

// 1つの読み込みが失敗しても顧客詳細全体を表示できなくしない(その部分だけエラー表示にする)
async function loadOrNull<T>(label: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    console.error(`[customer-detail] ${label} load failed`);
    return null;
  }
}

// 顧客情報・記録はこれまでどおりCustomerDetailClient(ブラウザ側)で読み込み、
// 無料鑑定申込・有料鑑定・アップセル・会話履歴・サマリーはサーバー側で取得して渡す
// (無料鑑定申込の詳細画面と同じデータ・同じ取得処理。二重に保存しない)。
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = await getCurrentAccountId();

  const [conversationMessages, freeReadingRequests, paidReadings, upsellPurchases, summary] =
    await Promise.all([
      // LINE未紐づけの顧客は手動登録分のみ(0件なら空配列)が返る
      loadOrNull("conversation messages", () => listConversationMessages(accountId, id)),
      loadOrNull("free reading requests", () => listCustomerFreeReadingRequests(accountId, id)),
      loadOrNull("paid readings", () => listPaidReadings(accountId, id)),
      loadOrNull("upsell purchases", () => listUpsellPurchases(accountId, id)),
      loadOrNull("summary", () => getCustomerSummary(accountId, id)),
    ]);

  const data: CustomerDetailData = {
    conversationMessages,
    freeReadingRequests,
    paidReadings,
    upsellPurchases,
    summary,
  };
  return <CustomerDetailClient id={id} data={data} />;
}
