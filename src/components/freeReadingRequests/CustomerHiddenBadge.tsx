// 申込に紐づく顧客が顧客管理で非表示(論理削除)中であることを示す補助バッジ。
// 申込自体は非表示にならないため、ステータスバッジの横に並べて表示する。
export function CustomerHiddenBadge() {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      顧客は非表示中
    </span>
  );
}
