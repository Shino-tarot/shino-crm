import { ConsultationStatsResult } from "@/lib/freeReadingRequests/consultationStats";
import { formatDate } from "@/lib/format";

interface ConsultationStatsCardProps {
  stats: ConsultationStatsResult;
}

export function ConsultationStatsCard({ stats }: ConsultationStatsCardProps) {
  if (!stats.available) {
    return (
      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
        相談回数を判定できません
      </div>
    );
  }

  const { count, firstApplicationDate, previousApplicationDate } = stats.stats;

  return (
    <div className="mt-4 rounded-md border border-violet-200 bg-violet-50 px-4 py-3">
      <p className="text-base font-semibold text-violet-800">
        今回で{count}回目の無料鑑定
      </p>
      <dl className="mt-1.5 flex flex-col gap-0.5 text-sm text-violet-700">
        <div className="flex flex-wrap gap-x-1.5">
          <dt>初回申込日：</dt>
          <dd className="font-medium">{formatDate(firstApplicationDate)}</dd>
        </div>
        {previousApplicationDate && (
          <div className="flex flex-wrap gap-x-1.5">
            <dt>前回申込日：</dt>
            <dd className="font-medium">{formatDate(previousApplicationDate)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
