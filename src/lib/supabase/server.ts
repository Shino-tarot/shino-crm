import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// サーバー専用クライアント（Route Handler / Server Actionからのみ使用）。
// service_roleキーはRLSを無視して全テーブルにアクセスできるため、
// 絶対にブラウザ側のコードやNEXT_PUBLIC_*環境変数には含めないこと。
export const supabaseServerClient = createClient(supabaseUrl, supabaseServiceRoleKey);
