import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseAuthClient } from "@/lib/supabase/auth";
import { isAdminEmail } from "@/lib/auth/adminEmails";

export interface StaffUser {
  // auth.users.id。将来、ユーザーごとの通知既読状態や操作履歴の記録に使う
  id: string;
  email: string;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

// ログイン中の管理者を返す。未ログイン・管理者以外はnull。
// getUser()はAuthサーバーへ問い合わせてセッションを検証するため、cookieの改ざんでは通過できない。
export async function getStaffUser(): Promise<StaffUser | null> {
  const supabase = await createSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email! };
}

// 全ての管理用Server Actionの先頭で呼ぶ。未ログイン・管理者以外は例外を投げて処理を中断する。
// (proxy.tsでも/customers以下を保護しているが、Server Actionは直接呼び出せるため、
//  ここで必ず二重にチェックする)
export async function requireStaff(): Promise<StaffUser> {
  const staff = await getStaffUser();
  if (!staff) throw new UnauthorizedError();
  return staff;
}

// Server Component(ページ・レイアウト)用。未ログイン・管理者以外はログイン画面へ移動させる。
export async function requireStaffPage(nextPath = "/customers"): Promise<StaffUser> {
  const staff = await getStaffUser();
  if (!staff) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return staff;
}
