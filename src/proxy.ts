import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdminEmail } from "@/lib/auth/adminEmails";

// CRM管理画面(/customers以下)を未ログイン・管理者以外から保護し、
// ログインセッション(cookie)の更新を行う。
// 公開ページ(/shino・/taiko・/free-reading等)はmatcherの対象外のため、一切影響しない。
// ここでのチェックは画面遷移時の振り分けであり、データへのアクセス可否は
// 各Server ActionのrequireStaff()で必ず再確認する。
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isStaff = isAdminEmail(user?.email);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/customers") && !isStaff) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isStaff) {
    const customersUrl = request.nextUrl.clone();
    customersUrl.pathname = "/customers";
    customersUrl.search = "";
    return NextResponse.redirect(customersUrl);
  }

  return response;
}

export const config = {
  matcher: ["/customers/:path*", "/login"],
};
