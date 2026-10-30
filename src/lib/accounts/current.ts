import "server-only";
import { cookies } from "next/headers";
import { StaffUser, requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerClient } from "@/lib/supabase/server";
import {
  ACCOUNT_COOKIE_NAME,
  ACCOUNT_MISMATCH_MESSAGE,
  AccountId,
  isSameAccount,
  resolveAccountId,
} from "@/lib/accounts/accounts";

// 選択中のアカウント(cookie)。未選択なら既定のアカウント
export async function getCurrentAccountId(): Promise<AccountId> {
  const store = await cookies();
  return resolveAccountId(store.get(ACCOUNT_COOKIE_NAME)?.value);
}

export class AccountMismatchError extends Error {
  constructor() {
    super(ACCOUNT_MISMATCH_MESSAGE);
    this.name = "AccountMismatchError";
  }
}

// 管理用Server Actionの先頭で呼ぶ。ログイン中の管理者であることに加え、
// 画面を表示したときのアカウント(expectedAccountId)と選択中のアカウントが一致することを確認する。
// 一致しない場合(別タブでの切り替え後の古い画面からの操作など)は例外を投げて処理を中断する。
export async function requireStaffAccount(
  expectedAccountId: unknown,
): Promise<{ staff: StaffUser; accountId: AccountId }> {
  const staff = await requireStaff();
  const accountId = await getCurrentAccountId();
  if (!isSameAccount(expectedAccountId, accountId)) throw new AccountMismatchError();
  return { staff, accountId };
}

// 指定した顧客が指定したアカウントに属しているか(別アカウントの顧客IDを指定された場合はfalse)。
// 0018の複合外部キーでもDB側で拒否されるが、保存前に分かりやすく判定するために使う
export async function isCustomerInAccount(accountId: AccountId, customerId: string): Promise<boolean> {
  const { data, error } = await supabaseServerClient
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    console.error("[accounts] customer check failed:", error.code);
    return false;
  }
  return data !== null;
}
