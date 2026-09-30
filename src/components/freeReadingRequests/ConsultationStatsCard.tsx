import { ConsultationStatsResult } from "@/lib/freeReadingRequests/consultationStats";
import { formatDate } from "@/lib/format";

interface ConsultationStatsCardProps {
  stats: ConsultationStatsResult;
}

// CustomerSummaryCardが主役になったため、こちらは初回/前回申込日を添える
// 補助的な1行表示に留める(集計ロジック自体は変更なし)。
export function ConsultationStatsCard({ stats }: ConsultationStatsCardProps) {
  if (!stats.available) {
    return null;
  }

  const { count, firstApplicationDate, previousApplicationDate } = stats.stats;

  return (
    <p className="mt-2 text-xs text-zinc-500">
      今回で{count}回目の無料鑑定（初回申込日: {formatDate(firstApplicationDate)}
      {previousApplicationDate &&
        `・前回申込日: ${formatDate(previousApplicationDate)}`}
      ）
    </p>
  );
}
