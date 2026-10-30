import { NewHearingForm } from "@/components/freeReadingRequests/NewHearingForm";
import { getCustomer } from "@/lib/customers/actions";
import { getCurrentAccountId } from "@/lib/accounts/current";
import { isUuid } from "@/lib/conversationMessages/validation";

export const dynamic = "force-dynamic";

// ?customerId=... 付きで開いた場合は、その顧客(選択中のアカウント・表示中のみ)の申込として登録する
export default async function NewHearingPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const accountId = await getCurrentAccountId();
  const customer = isUuid(customerId) ? await getCustomer(accountId, customerId) : null;

  if (customerId && (!customer || customer.deletedAt !== null)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-sm text-zinc-500">
          顧客が見つからないか、非表示中のため追加できません。顧客管理から開き直してください。
        </p>
      </div>
    );
  }

  return (
    <NewHearingForm
      customer={
        customer
          ? {
              id: customer.id,
              customerNo: customer.customerNo,
              readingName: customer.readingName,
              lineName: customer.lineName,
              birthday: customer.birthday,
            }
          : null
      }
    />
  );
}
