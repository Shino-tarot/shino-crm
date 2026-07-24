import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ブラウザから使うクライアント。anonキーを使用するため、
// RLSでanonへのアクセスを許可したテーブル（free_reading_requestsへのinsertなど）にのみ使う。
export const supabaseBrowserClient = createClient(supabaseUrl, supabaseAnonKey);
