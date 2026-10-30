"use server";

import { cookies } from "next/headers";
import { requireStaff } from "@/lib/auth/requireStaff";
import { ACCOUNT_COOKIE_NAME, AccountId, isAccountId } from "@/lib/accounts/accounts";

// 選択中のアカウントを切り替える(cookieに保存する)。データの変更は行わない
export async function switchAccount(
  accountId: AccountId,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff();
  if (!isAccountId(accountId)) {
    return { ok: false, error: "アカウントが正しく指定されていません。" };
  }
  const store = await cookies();
  store.set(ACCOUNT_COOKIE_NAME, accountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // 1年間保持する(ブラウザを閉じても選択を覚えておく)
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}
