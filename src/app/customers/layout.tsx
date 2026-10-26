import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { requireStaffPage } from "@/lib/auth/requireStaff";

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

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
