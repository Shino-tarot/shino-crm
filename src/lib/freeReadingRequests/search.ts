import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";

export interface FreeReadingRequestSearchResult {
  item: FreeReadingRequestListItem;
  // 鑑定コードが完全一致した場合はtrue。一覧で最優先表示・強調するために使う
  isExactCodeMatch: boolean;
}

// 一覧の検索(鑑定コード優先・LINE表示名/相談者名は部分一致)。
// 既存の一覧ソート順(applicationDate→createdAt降順、呼び出し元で事前ソート済み)は
// Array.prototype.sortが安定ソートであることを利用して、絞り込み後も維持する
// (完全一致のみ先頭へ引き上げ、それ以外は元の並び順のまま)。
export function searchFreeReadingRequests(
  requests: FreeReadingRequestListItem[],
  rawQuery: string,
): FreeReadingRequestSearchResult[] {
  const query = rawQuery.trim();

  if (!query) {
    return requests.map((item) => ({ item, isExactCodeMatch: false }));
  }

  const lowerQuery = query.toLowerCase();

  const matched = requests
    .map((item) => {
      const isExactCodeMatch = item.diagnosisCode === query;
      const matchesCode = item.diagnosisCode?.includes(query) ?? false;
      const matchesLineName = item.lineName.toLowerCase().includes(lowerQuery);
      const matchesName = item.name.toLowerCase().includes(lowerQuery);

      if (!isExactCodeMatch && !matchesCode && !matchesLineName && !matchesName) {
        return null;
      }

      return { item, isExactCodeMatch };
    })
    .filter((result): result is FreeReadingRequestSearchResult => result !== null);

  return matched.sort((a, b) => {
    if (a.isExactCodeMatch === b.isExactCodeMatch) return 0;
    return a.isExactCodeMatch ? -1 : 1;
  });
}
