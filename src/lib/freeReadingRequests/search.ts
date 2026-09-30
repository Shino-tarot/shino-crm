import { FreeReadingRequestListItem } from "@/lib/freeReadingRequests/mapper";

// 一覧の検索(LINE表示名・相談者名の部分一致)。
// 診断Webアプリ連携の撤去に伴い、鑑定コードによる検索は廃止した。
// 呼び出し元の一覧ソート順(applicationDate→createdAt降順、事前ソート済み)は
// Array.prototype.filterが順序を保持することを利用してそのまま維持する。
export function searchFreeReadingRequests(
  requests: FreeReadingRequestListItem[],
  rawQuery: string,
): FreeReadingRequestListItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return requests;

  return requests.filter(
    (item) =>
      item.lineName.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query),
  );
}
