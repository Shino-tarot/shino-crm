import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ログインセッション(cookie)の確認・ログイン・ログアウト専用のクライアント。
// anonキーを使うため、顧客データの読み書きには使わない
// (データアクセスは従来どおりsupabaseServerClientで、requireStaff()を通過した後にのみ行う)。
// リクエストごとに新しく作成すること(リクエスト間で共有しない)。
export async function createSupabaseAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Componentからはcookieを書き込めない。
          // セッションの更新はproxy.tsが行うため、ここでは無視してよい。
        }
      },
    },
  });
}
