"use client";

import { ReactNode, createContext, useContext } from "react";
import { AccountId } from "@/lib/accounts/accounts";

// 画面を表示したときのアカウント。Server Actionに必ず一緒に渡し、
// サーバー側で「選択中のアカウント」と一致するかを確認する(requireStaffAccount)
const AccountContext = createContext<AccountId | null>(null);

export function AccountProvider({
  accountId,
  children,
}: {
  accountId: AccountId;
  children: ReactNode;
}) {
  return <AccountContext.Provider value={accountId}>{children}</AccountContext.Provider>;
}

export function useAccountId(): AccountId {
  const accountId = useContext(AccountContext);
  if (!accountId) throw new Error("useAccountId must be used inside AccountProvider");
  return accountId;
}
