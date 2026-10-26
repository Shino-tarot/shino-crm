// CRM管理画面へのアクセスを許可するメールアドレス(環境変数CRM_ADMIN_EMAILS、カンマ区切り)。
// 未設定・空の場合は誰も許可しない(設定漏れで全員が通る状態にならないよう、閉じた側に倒す)。
// proxy.tsからも使うため"server-only"は付けていないが、NEXT_PUBLIC_ではない環境変数のため
// ブラウザ側のバンドルには値が含まれない。
export function getAdminEmails(): string[] {
  return (process.env.CRM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email !== "");
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

// ログイン後の遷移先として許可するのはCRM管理画面内のパスのみ
// (外部URLや//evil.example等へのオープンリダイレクトを防ぐ)。
export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value) return "/customers";
  if (!value.startsWith("/customers")) return "/customers";
  if (value.startsWith("//") || value.includes("\\")) return "/customers";
  return value;
}
