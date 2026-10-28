"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// CRMを開いている間、10分ごとにサーバー側の表示を再取得する。
// 再取得のたびにレイアウトでステータス自動更新が走る(外部Cronは使わない)。
// router.refresh()は入力中のフォームなどクライアント側の状態を保持する。
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
