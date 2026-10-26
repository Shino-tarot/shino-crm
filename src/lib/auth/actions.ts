"use server";

import { redirect } from "next/navigation";
import { createSupabaseAuthClient } from "@/lib/supabase/auth";
import {
  getAdminEmails,
  isAdminEmail,
  sanitizeNextPath,
} from "@/lib/auth/adminEmails";

export interface SignInState {
  error: string;
}

const INVALID_CREDENTIALS_MESSAGE =
  "メールアドレスまたはパスワードが正しくありません。";

// ログイン画面のフォームから呼ばれる(ログイン前に呼ぶ必要があるため認可チェックはしない)。
// 管理者以外のアカウントは、パスワードが正しくてもログイン状態を残さず拒否する。
export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  if (getAdminEmails().length === 0) {
    console.error("[auth] CRM_ADMIN_EMAILS is not configured");
    return {
      error:
        "現在ログインを受け付けられない設定になっています。管理者設定(CRM_ADMIN_EMAILS)をご確認ください。",
    };
  }

  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  if (!isAdminEmail(data.user.email)) {
    await supabase.auth.signOut();
    console.warn("[auth] rejected non-admin sign in");
    // 管理者として登録されているかどうかを外部に知らせないよう、同じ文言で返す
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  redirect(nextPath);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
