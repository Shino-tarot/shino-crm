import { formatCurrency } from "@/lib/format";

interface CustomerSummaryCardProps {
  // 無料鑑定回数はLINE表示名ベースの履歴突合(computeConsultationStats)からも
  // 算出できるため、顧客未登録でも必ず数値で受け取る。
  freeReadingCount: number;
  // 有料鑑定・アップセル・累計購入額はcustomer_id紐付け後でないと安全に
  // 集計できないため、未登録時はnull("—"表示)を渡す。
  paidReadingCount: number | null;
  upsellCount: number | null;
  totalAmount: number | null;
}

function formatCount(value: number | null): string {
  return value === null ? "—" : `${value}回`;
}

// 無料鑑定回数・有料鑑定回数・アップセル回数・累計購入額の4項目を表示する
// カルテ最上部のサマリーカード。値はすべて呼び出し元で算出済みのものを
// そのまま表示するだけで、このコンポーネント自体は集計を行わない。
export function CustomerSummaryCard({
  freeReadingCount,
  paidReadingCount,
  upsellCount,
  totalAmount,
}: CustomerSummaryCardProps) {
  const items = [
    { label: "無料鑑定", value: `${freeReadingCount}回` },
    { label: "有料鑑定", value: formatCount(paidReadingCount) },
    { label: "アップセル", value: formatCount(upsellCount) },
    {
      label: "累計購入額",
      value: totalAmount === null ? "—" : formatCurrency(totalAmount),
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-violet-200 bg-violet-50 p-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <p className="text-xs text-violet-600">{item.label}</p>
          <p className="mt-0.5 text-lg font-semibold text-violet-900">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
