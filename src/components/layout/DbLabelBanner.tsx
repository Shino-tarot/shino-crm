// 検証用DBに接続しているときだけ、管理画面上部に帯を表示する。
// NEXT_PUBLIC_CRM_DB_LABELは.env.development.localにのみ設定するため、本番では表示されない。
export function DbLabelBanner() {
  const label = process.env.NEXT_PUBLIC_CRM_DB_LABEL?.trim();
  if (!label) return null;

  return (
    <div
      role="status"
      className="bg-amber-400 px-6 py-2 text-center text-sm font-bold text-amber-950"
    >
      {label}に接続中（本番データではありません）
    </div>
  );
}
