"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { BasicInfoTab } from "@/components/customers/tabs/BasicInfoTab";
import { RecordListTab } from "@/components/customers/tabs/RecordListTab";
import { ConversationSection } from "@/components/conversationMessages/ConversationSection";
import { CustomerHiddenBanner } from "@/components/customers/CustomerHiddenBanner";
import { CustomerSummaryCard } from "@/components/customers/CustomerSummaryCard";
import { CustomerFreeReadingTab } from "@/components/customers/tabs/CustomerFreeReadingTab";
import { PaidReadingSection } from "@/components/paidReadings/PaidReadingSection";
import { UpsellPurchaseSection } from "@/components/upsellPurchases/UpsellPurchaseSection";
import { Tabs } from "@/components/ui/Tabs";
import { useCustomers } from "@/hooks/useCustomers";
import { RECORD_CATEGORIES } from "@/lib/recordCategories";
import { ConversationMessage } from "@/types/conversationMessage";
import { CustomerSummary } from "@/types/customerSummary";
import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";
import { PaidReading } from "@/types/paidReading";
import { UpsellPurchase } from "@/types/upsellPurchase";

const FREE_READING_TAB_KEY = "freeReadingRequests";
const PURCHASE_TAB_KEY = "purchases";
const CONVERSATION_TAB_KEY = "conversation";

// サーバー側で取得したデータ(無料鑑定申込の詳細画面と同じ取得処理の結果。二重には保存しない)。
// 取得に失敗した項目はnull(そのタブのみエラー表示にし、他のタブは通常どおり使えるようにする)
export interface CustomerDetailData {
  conversationMessages: ConversationMessage[] | null;
  freeReadingRequests: FreeReadingRequestListItem[] | null;
  paidReadings: PaidReading[] | null;
  upsellPurchases: UpsellPurchase[] | null;
  summary: CustomerSummary | null;
}

interface CustomerDetailClientProps {
  id: string;
  data: CustomerDetailData;
}

function LoadError({ label }: { label: string }) {
  return (
    <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
      {label}の読み込みに失敗しました。時間をおいて再度お試しください。
    </p>
  );
}

// 顧客管理の顧客詳細。無料鑑定申込から有料鑑定・アップセル・会話履歴までをこの画面でまとめて扱う。
// 保存・削除後は各セクション内のrouter.refresh()でサーバーから再取得される。
export function CustomerDetailClient({ id, data }: CustomerDetailClientProps) {
  const { customers, isLoaded, updateCustomer, restoreCustomer } = useCustomers();
  const [activeTab, setActiveTab] = useState(FREE_READING_TAB_KEY);

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-zinc-400">
        読み込み中...
      </div>
    );
  }

  const customer = customers.find((c) => c.id === id);

  if (!customer) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-sm text-zinc-500">顧客が見つかりませんでした。</p>
        <Link
          href="/customers"
          className="mt-4 inline-block text-sm text-violet-600 hover:text-violet-800"
        >
          ← 顧客一覧に戻る
        </Link>
      </div>
    );
  }

  const tabs = [
    { key: FREE_READING_TAB_KEY, label: "無料鑑定申込" },
    { key: PURCHASE_TAB_KEY, label: "有料鑑定・アップセル" },
    { key: CONVERSATION_TAB_KEY, label: "会話履歴" },
    { key: "basic", label: "基本情報" },
    // 以前の「記録」タブ(customer_records)。データは残し、従来どおり閲覧・編集できる
    ...RECORD_CATEGORIES.map((category) => ({
      key: category.key,
      label: `${category.label}（旧記録）`,
    })),
  ];

  const activeRecordCategory = RECORD_CATEGORIES.find(
    (category) => category.key === activeTab,
  );

  let tabContent: ReactNode = null;
  if (activeTab === FREE_READING_TAB_KEY) {
    tabContent = data.freeReadingRequests ? (
      <CustomerFreeReadingTab
        customerId={customer.id}
        customerHidden={customer.deletedAt !== null}
        requests={data.freeReadingRequests}
      />
    ) : (
      <LoadError label="無料鑑定申込" />
    );
  } else if (activeTab === PURCHASE_TAB_KEY) {
    tabContent = (
      <>
        {data.paidReadings ? (
          <PaidReadingSection customerId={customer.id} readings={data.paidReadings} />
        ) : (
          <LoadError label="有料鑑定" />
        )}
        {data.upsellPurchases ? (
          <UpsellPurchaseSection customerId={customer.id} purchases={data.upsellPurchases} />
        ) : (
          <LoadError label="アップセル" />
        )}
      </>
    );
  } else if (activeTab === CONVERSATION_TAB_KEY) {
    tabContent = data.conversationMessages ? (
      <ConversationSection customerId={customer.id} messages={data.conversationMessages} />
    ) : (
      <LoadError label="会話履歴" />
    );
  } else if (activeTab === "basic") {
    tabContent = (
      <BasicInfoTab
        customer={customer}
        onUpdate={(values) => updateCustomer(customer.id, values)}
      />
    );
  } else if (activeRecordCategory) {
    tabContent = <RecordListTab customerId={customer.id} config={activeRecordCategory} />;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/customers"
        className="text-sm text-violet-600 hover:text-violet-800"
      >
        ← 顧客一覧に戻る
      </Link>

      <div className="mt-3">
        <CustomerHiddenBanner customer={customer} onRestore={restoreCustomer} />
      </div>

      <div className="mt-3 mb-4">
        <p className="text-sm font-semibold text-zinc-600">顧客番号 No.{customer.customerNo}</p>
        <h1 className="text-xl font-semibold text-zinc-900">
          {customer.readingName}
        </h1>
        {customer.lineName && (
          <p className="text-sm text-zinc-500">
            （LINE：{customer.lineName}）
          </p>
        )}
      </div>

      {data.summary && (
        <div className="mb-6">
          <CustomerSummaryCard
            freeReadingCount={data.summary.freeReadingCount}
            paidReadingCount={data.summary.paidReadingCount}
            upsellCount={data.summary.upsellCount}
            totalAmount={data.summary.totalAmount}
          />
        </div>
      )}

      <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

      <div className="mt-6">{tabContent}</div>
    </div>
  );
}
