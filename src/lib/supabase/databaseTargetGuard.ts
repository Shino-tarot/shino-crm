// Vercel の Preview デプロイが本番DBを読み書きしないための安全装置。
// Vercel の環境変数は Production と Preview で共有されている場合があるため、
// Preview では検証用DBの目印(NEXT_PUBLIC_CRM_DB_LABEL。検証用DBの接続設定と一緒にだけ設定する)が無ければ、
// DBへの接続そのものを拒否する(本番DBの接続設定のまま動いてしまうことを防ぐ)。
// Production・ローカル(VERCEL_ENV なし)では何もしない。DBに依存しない純粋な判定のみ(単体テストから使う)。

export const PREVIEW_DB_NOT_ISOLATED = "PREVIEW_DB_NOT_ISOLATED";

type Env = Record<string, string | undefined>;

export function isDatabaseTargetAllowed(env: Env): boolean {
  if (env.VERCEL_ENV !== "preview") return true;
  return Boolean(env.NEXT_PUBLIC_CRM_DB_LABEL?.trim());
}

export function assertDatabaseTargetAllowed(env: Env): void {
  if (!isDatabaseTargetAllowed(env)) {
    throw new Error(
      `${PREVIEW_DB_NOT_ISOLATED}: Preview では検証用DBの環境変数(NEXT_PUBLIC_CRM_DB_LABEL など)が必要です。本番DBには接続しません`,
    );
  }
}
