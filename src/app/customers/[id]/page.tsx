"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BasicInfoTab } from "@/components/customers/tabs/BasicInfoTab";
import { RecordListTab } from "@/components/customers/tabs/RecordListTab";
import { Tabs } from "@/components/ui/Tabs";
import { useCustomers } from "@/hooks/useCustomers";
import { RECORD_CATEGORIES } from "@/lib/recordCategories";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { customers, isLoaded, updateCustomer } = useCustomers();
  const [activeTab, setActiveTab] = useState("basic");

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
    { key: "basic", label: "基本情報" },
    ...RECORD_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
    })),
  ];

  const activeRecordCategory = RECORD_CATEGORIES.find(
    (category) => category.key === activeTab,
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/customers"
        className="text-sm text-violet-600 hover:text-violet-800"
      >
        ← 顧客一覧に戻る
      </Link>

      <div className="mt-3 mb-6">
        <p className="text-xs text-zinc-400">顧客ID: No.{customer.customerNo}</p>
        <h1 className="text-xl font-semibold text-zinc-900">
          {customer.readingName}
        </h1>
        {customer.lineName && (
          <p className="text-sm text-zinc-500">
            （LINE：{customer.lineName}）
          </p>
        )}
      </div>

      <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === "basic" && (
          <BasicInfoTab
            customer={customer}
            onUpdate={(values) => updateCustomer(customer.id, values)}
          />
        )}
        {activeRecordCategory && (
          <RecordListTab
            customerId={customer.id}
            config={activeRecordCategory}
          />
        )}
      </div>
    </div>
  );
}
