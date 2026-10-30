import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { DbLabelBanner } from "@/components/layout/DbLabelBanner";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { requireStaffPage } from "@/lib/auth/requireStaff";
import { syncAutoStatuses } from "@/lib/statusAutoUpdate/sync";
import { FollowUpNoticePanel } from "@/components/layout/FollowUpNoticePanel";
import { getFollowUpNotices } from "@/lib/followUp/notices";
import { getCurrentAccountId } from "@/lib/accounts/current";
import { AccountProvider } from "@/components/accounts/AccountProvider";

// 顧客情報を扱う管理画面のため、検索エンジンにインデックスさせない
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// proxy.tsに加えてレイアウトでもログイン状態を確認する(未ログイン・管理者以外はログイン画面へ)。
// データへのアクセス可否は各Server ActionのrequireStaff()で別途確認している。
export default async function CustomersLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireStaffPage();
  // 選択中のアカウント(鯛子・夜宵)。この配下の画面はすべてこのアカウントのデータだけを表示する
  const accountId = await getCurrentAccountId();
  // CRMを開いたとき(と10分ごとの再取得時)に、送信日時を過ぎた鑑定のステータスを進める
  // (申込と同じ顧客の有料鑑定だけを見るため、アカウントをまたいで処理されることはない)
  await syncAutoStatuses();
  // 自動更新の後に読むことで、対応不要・完了などの最新ステータスで通知対象を判定する
  const followUpNotices = await getFollowUpNotices(accountId);

  return (
    <AccountProvider accountId={accountId}>
      <AutoRefresh />
      <DbLabelBanner />
      <AppHeader accountId={accountId} />
      <FollowUpNoticePanel {...followUpNotices} />
      {children}
    </AccountProvider>
  );
}
