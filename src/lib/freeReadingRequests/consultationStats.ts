export interface ConsultationStatsInput {
  id: string;
  lineName: string;
  applicationDate: string | null;
  createdAt: string;
}

export interface ConsultationStats {
  count: number;
  // application_dateが空の場合はcreated_atをそのまま保持する(表示側でformatDateする)
  firstApplicationDate: string;
  previousApplicationDate: string | null;
}

export type ConsultationStatsResult =
  | { available: true; stats: ConsultationStats }
  | { available: false };

function effectiveDateSource(item: ConsultationStatsInput): string {
  return item.applicationDate ?? item.createdAt;
}

function effectiveDateValue(item: ConsultationStatsInput): number {
  return new Date(effectiveDateSource(item)).getTime();
}

// 現在表示中の申込 + 過去履歴(listFreeReadingRequestHistoryの結果、line_name完全一致・
// 現在レコード除外済み)から、相談回数・初回申込日・前回申込日を算出する。
// 追加のDB問い合わせは行わず、既存の履歴取得結果のみで完結させる。
export function computeConsultationStats(
  current: ConsultationStatsInput,
  history: ConsultationStatsInput[],
): ConsultationStatsResult {
  if (!current.lineName.trim()) {
    return { available: false };
  }

  const all = [current, ...history];

  // application_date優先、空ならcreated_at、同日はcreated_atで決着する降順ソート
  const sorted = [...all].sort((a, b) => {
    const dateDiff = effectiveDateValue(b) - effectiveDateValue(a);
    if (dateDiff !== 0) return dateDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const currentIndex = sorted.findIndex((item) => item.id === current.id);
  const previous = currentIndex >= 0 ? sorted[currentIndex + 1] : undefined;
  const oldest = sorted[sorted.length - 1];

  return {
    available: true,
    stats: {
      count: sorted.length,
      firstApplicationDate: effectiveDateSource(oldest),
      previousApplicationDate: previous ? effectiveDateSource(previous) : null,
    },
  };
}
