// 送信予定日時が未来の鑑定(無料・有料)があることを示す補助バッジ。
// ステータスではないため、ステータスバッジの横に並べて表示する。
export function ScheduledSendBadge() {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
      送信予約中
    </span>
  );
}
