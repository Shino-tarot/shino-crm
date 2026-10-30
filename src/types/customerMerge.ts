import {
  BirthdayCheck,
  LineMergeState,
  MergeBlockReason,
  MergeConfirmRequirements,
  MergeEvidence,
} from "@/lib/customers/mergeRules";
import { RequestCustomerMismatch } from "@/lib/freeReadingRequests/customerLink";

// 統合で統合先へ移る件数(論理削除済みのものも含む)
export interface MergeMovedCounts {
  requests: number;
  paidReadings: number;
  upsellPurchases: number;
  customerRecords: number;
  manualMessages: number;
  // LINEから自動保存した受信メッセージ(LINE送信者と一緒に統合先へ表示が移る)
  lineMessages: number;
}

// 確認画面で統合元・統合先を並べて比べるための情報(LINE User ID自体は含めない)
export interface MergeComparisonSide {
  // 顧客番号(顧客未登録の場合はnull)
  customerNo: number | null;
  readingName: string;
  realName: string;
  lineName: string;
  // 判定に使う生年月日(顧客の生年月日、無ければ最新の申込の生年月日)
  birthday: string | null;
  // この申込に書かれた名前・生年月日(顧客の情報と違う場合は、別の人の申込が登録されている可能性がある)
  requestName: string;
  requestBirthDate: string | null;
  requestMismatch: RequestCustomerMismatch[];
  // この申込に書かれたお相手の情報(任意項目)
  partnerName: string | null;
  partnerBirthDate: string | null;
  lineLinked: boolean;
  lineContactDisplayName: string | null;
  // 申込の一覧(新しい順・最大10件)
  requests: { date: string; status: string }[];
  requestCount: number;
  paidReadingCount: number;
}

export type MergePreview =
  // 既に同じ顧客
  | { kind: "already_same" }
  | {
      // attach_request: 統合元の申込にまだ顧客が無い(その申込1件を統合先の顧客に紐付ける)
      // merge: 統合元の顧客のデータを統合先へまとめる
      kind: "attach_request" | "merge";
      source: MergeComparisonSide;
      target: MergeComparisonSide;
      counts: MergeMovedCounts;
      lineState: LineMergeState;
      // 統合先のLINE User IDが空のため、統合元の値を入れる
      fillsTargetLineUserId: boolean;
      evidence: MergeEvidence;
      birthdayCheck: BirthdayCheck;
      requirements: MergeConfirmRequirements;
      blockReason: MergeBlockReason | null;
    };

export type MergeResult = { ok: true; customerId: string } | { ok: false; error: string };
