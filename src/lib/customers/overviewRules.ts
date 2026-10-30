// 顧客一覧に出す「最新ステータス・最終申込日・申込件数・LINE連携」の集計(DBに依存しない純粋な関数。単体テストの対象)。
// 値はすべて申込(free_reading_requests)とLINE送信者(line_contacts)から都度求め、顧客側には保存しない。

export interface CustomerOverview {
  latestStatus: string | null;
  // 最終申込日(申込日、無ければ登録日時)
  lastApplicationDate: string | null;
  requestCount: number;
  lineLinked: boolean;
}

export interface OverviewRequestRow {
  customer_id: string;
  status: string;
  application_date: string | null;
  created_at: string;
}

function requestTime(row: OverviewRequestRow): number {
  return new Date(row.application_date ?? row.created_at).getTime();
}

// 最新の申込 = 申込日(無ければ登録日時)が最も新しいもの。同じ日なら登録日時が新しいもの
function isNewer(a: OverviewRequestRow, b: OverviewRequestRow): boolean {
  const diff = requestTime(a) - requestTime(b);
  if (diff !== 0) return diff > 0;
  return new Date(a.created_at).getTime() > new Date(b.created_at).getTime();
}

export function summarizeCustomerOverviews(
  requests: OverviewRequestRow[],
  linkedCustomerIds: Iterable<string>,
): Record<string, CustomerOverview> {
  const result: Record<string, CustomerOverview> = {};
  const latest = new Map<string, OverviewRequestRow>();
  for (const row of requests) {
    const overview = (result[row.customer_id] ??= {
      latestStatus: null,
      lastApplicationDate: null,
      requestCount: 0,
      lineLinked: false,
    });
    overview.requestCount += 1;
    const current = latest.get(row.customer_id);
    if (!current || isNewer(row, current)) latest.set(row.customer_id, row);
  }
  for (const [customerId, row] of latest) {
    result[customerId].latestStatus = row.status;
    result[customerId].lastApplicationDate = row.application_date ?? row.created_at;
  }
  for (const customerId of linkedCustomerIds) {
    (result[customerId] ??= {
      latestStatus: null,
      lastApplicationDate: null,
      requestCount: 0,
      lineLinked: false,
    }).lineLinked = true;
  }
  return result;
}
