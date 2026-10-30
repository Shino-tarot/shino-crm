import { createHmac, timingSafeEqual } from "node:crypto";

// LINEのWebhook署名(x-line-signature)を検証する。
// 署名 = Base64(HMAC-SHA256(チャネルシークレット, リクエスト本文の生バイト列))。
// JSONとして解釈・整形し直した本文では一致しないため、必ず受信したままのバイト列を渡すこと。
export function verifyLineSignature(
  rawBody: Buffer,
  signature: string | null,
  channelSecret: string,
): boolean {
  if (!signature || !channelSecret) return false;

  const expected = createHmac("sha256", channelSecret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  // 長さが違うとtimingSafeEqualが例外を投げるため先に比較する
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
