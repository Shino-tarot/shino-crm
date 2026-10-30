import { NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line/signature";
import { parseWebhookBody } from "@/lib/line/webhookEvents";
import { processLineWebhookEvents } from "@/lib/line/processWebhook";
import { createSupabaseLineWebhookStore } from "@/lib/line/webhookStore";
import { INBOUND_ACCOUNT_ID } from "@/lib/accounts/accounts";

// LINE公式アカウント(Messaging API)からのWebhook受信口。
// お客様から届いたメッセージを会話履歴(conversation_messages)へ「受信」として保存するだけで、
// 自動返信・メッセージ送信は一切行わない。
//
// 安全のための前提:
//   - ログイン不要で外部から呼ばれる(proxy.tsの保護対象外)ため、LINEの署名検証を通った通知だけを処理する。
//   - LINE_CHANNEL_SECRETが未設定の環境では、すべての通知を拒否する(設定するまで機能は無効)。
//   - ログにはメッセージ本文・LINEユーザーID・表示名・秘密情報を出さない(件数とエラーコードのみ)。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// LINEのWebhookは通常数KB。これを超える本文は処理しない
const MAX_BODY_BYTES = 1024 * 1024;

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.error("[line-webhook] LINE_CHANNEL_SECRET is not set");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  // 署名は生のバイト列で検証する(JSONに変換してからでは一致しない)
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const signature = request.headers.get("x-line-signature");
  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    console.warn("[line-webhook] rejected: invalid signature");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = parseWebhookBody(rawBody.toString("utf8"));
  if (!body) {
    console.warn("[line-webhook] rejected: invalid body");
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // LINE DevelopersのWebhook URL「検証」ボタンは、イベントが空の通知を送ってくる
  if (body.events.length === 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    // この受け口(LINE_CHANNEL_SECRET のチャネル)は鯛子専用。夜宵は本番用プロバイダーの準備後に別の受け口を追加する
    const store = createSupabaseLineWebhookStore(INBOUND_ACCOUNT_ID, process.env.LINE_CHANNEL_ACCESS_TOKEN);
    const summary = await processLineWebhookEvents(body.events, store);
    console.info("[line-webhook] processed:", summary);
    return NextResponse.json({ ok: true });
  } catch {
    // 500を返すとLINE側の設定(Webhookの再送)が有効な場合に再送される。保存済みのイベントは重複として無視される
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
