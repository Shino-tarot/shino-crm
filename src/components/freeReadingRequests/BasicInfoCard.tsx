import { HearingFormValues } from "@/types/freeReadingRequest";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";
import { formatDate } from "@/lib/format";

interface BasicInfoCardProps {
  values: HearingFormValues;
  onEdit: () => void;
  // computeConsultationStats(LINE表示名ベースの既存履歴突合、ロジック不変)から
  // 渡される初回申込日。新しいDB項目は追加していない。
  firstApplicationDate?: string | null;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-zinc-900">{value}</dd>
    </div>
  );
}

// 「編集フォームがそのまま並んでいる」印象を避けるための閲覧用カード。
// 保存済みの値(HearingFormValues)を表示するだけで、保存ロジックは持たない。
export function BasicInfoCard({
  values,
  onEdit,
  firstApplicationDate,
}: BasicInfoCardProps) {
  const statusInfo = STATUS_LABELS[values.status] ?? {
    label: values.status,
    className: "bg-zinc-100 text-zinc-500",
  };

  return (
    <section className="mt-6 rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">基本情報</h2>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          編集する
        </button>
      </div>

      <dl className="mt-3 divide-y divide-zinc-100">
        <InfoRow label="LINE表示名" value={values.lineName || "—"} />
        <InfoRow label="相談者名" value={values.name || "（未入力）"} />
        <InfoRow
          label="生年月日"
          value={values.birthDate ? formatDate(values.birthDate) : "—"}
        />
        <InfoRow
          label="お相手"
          value={
            values.partnerName
              ? `${values.partnerName}${
                  values.partnerBirthDate
                    ? `（${formatDate(values.partnerBirthDate)}）`
                    : ""
                }`
              : "—"
          }
        />
        <InfoRow
          label="申込日"
          value={
            values.applicationDate ? formatDate(values.applicationDate) : "—"
          }
        />
        {firstApplicationDate && (
          <InfoRow label="初回申込日" value={formatDate(firstApplicationDate)} />
        )}
      </dl>

      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
        <span className="text-xs text-zinc-500">ステータス</span>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
        >
          {statusInfo.label}
        </span>
      </div>
    </section>
  );
}
