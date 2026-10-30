// 顧客統合の判定(DBに依存しない純粋な関数のみ。単体テストの対象)。
// 実際の統合はDB関数 merge_customers(0015、0018で置き換え)が1つのトランザクションで行い、
// 競合があれば何も変更せずにエラーにする。ここでは確認画面で同じ条件を事前に判定・表示するために使う。
// LINE User IDはサーバー内の判定にのみ使い、判定結果だけを画面へ返す。
// LINE表示名・名前の一致は本人確認の根拠として扱わない(根拠になるのはLINE User IDの一致のみ)。

export interface MergeSideState {
  // 顧客のアカウント(鯛子・夜宵)。アカウントが違う顧客は統合しない
  accountId: string;
  hidden: boolean;
  // customers.line_user_id(未登録は空文字)
  lineUserId: string;
  // この顧客に紐づくLINE送信者のLINE User ID(紐づいていなければnull)
  linkedContactLineUserId: string | null;
  // 判定用の生年月日("YYYY-MM-DD")。顧客の生年月日、無ければ最新の申込の生年月日(DB関数と同じ)。不明はnull
  birthday: string | null;
}

export type MergeBlockReason =
  | "cross_account"
  | "customer_hidden"
  | "line_both_linked"
  | "line_user_id_conflict";

export const MERGE_BLOCK_MESSAGES: Record<MergeBlockReason, string> = {
  cross_account:
    "アカウント(鯛子・夜宵)が違う顧客どうしは統合できません。同じ名前でも別の顧客として管理します。",
  customer_hidden:
    "非表示中の顧客が含まれるため統合できません。顧客管理で復元してから操作してください。",
  line_both_linked:
    "両方の顧客にそれぞれ別のLINE送信者が紐づいているため統合できません。どちらかの紐づけを解除するか、別人でないか確認してください。",
  line_user_id_conflict:
    "2人の顧客のLINE User IDが一致しないため統合できません(別のLINEアカウントの可能性があります)。",
};

export const MERGE_BIRTHDAY_MISMATCH_MESSAGE =
  "2人の生年月日が一致しないため、原則として統合できません。どうしても統合する場合は、確認した内容を理由として入力してください。";

// DB関数のエラーコード → 画面用のメッセージ
const DB_ERROR_MESSAGES: Record<string, string> = {
  MERGE_CROSS_ACCOUNT: MERGE_BLOCK_MESSAGES.cross_account,
  MERGE_CUSTOMER_HIDDEN: MERGE_BLOCK_MESSAGES.customer_hidden,
  MERGE_LINE_BOTH_LINKED: MERGE_BLOCK_MESSAGES.line_both_linked,
  MERGE_LINE_USER_ID_CONFLICT: MERGE_BLOCK_MESSAGES.line_user_id_conflict,
  MERGE_BIRTHDAY_MISMATCH: MERGE_BIRTHDAY_MISMATCH_MESSAGE,
  MERGE_SAME_CUSTOMER: "既に同じ顧客です。",
  MERGE_CUSTOMER_NOT_FOUND: "顧客が見つかりません。画面を再読み込みしてください。",
  MERGE_INVALID_ARGUMENT: "統合する顧客が正しく指定されていません。",
};

const DEFAULT_MERGE_ERROR =
  "統合に失敗しました。データは変更されていません。時間をおいて再度お試しください。";

// DBのエラーメッセージ(例: "MERGE_LINE_BOTH_LINKED")から画面用のメッセージを返す
export function mergeErrorMessageFromDb(message: string | undefined): string {
  const code = (message ?? "").match(/MERGE_[A-Z_]+/)?.[0];
  return (code && DB_ERROR_MESSAGES[code]) || DEFAULT_MERGE_ERROR;
}

function hasValue(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.trim() !== "";
}

// DB関数 merge_customers と同じ条件で、統合できない理由を返す(nullなら統合可能)
export function getMergeBlockReason(
  source: MergeSideState,
  target: MergeSideState,
): MergeBlockReason | null {
  if (source.accountId !== target.accountId) return "cross_account";
  if (source.hidden || target.hidden) return "customer_hidden";
  if (source.linkedContactLineUserId !== null && target.linkedContactLineUserId !== null) {
    return "line_both_linked";
  }
  const sourceId = source.lineUserId.trim();
  const targetId = target.lineUserId.trim();
  const conflicts =
    (hasValue(sourceId) && hasValue(targetId) && sourceId !== targetId) ||
    (source.linkedContactLineUserId !== null &&
      hasValue(targetId) &&
      targetId !== source.linkedContactLineUserId) ||
    (target.linkedContactLineUserId !== null &&
      hasValue(sourceId) &&
      sourceId !== target.linkedContactLineUserId) ||
    (source.linkedContactLineUserId !== null &&
      hasValue(sourceId) &&
      sourceId !== source.linkedContactLineUserId);
  return conflicts ? "line_user_id_conflict" : null;
}

// 生年月日の一致状況(両方わかっている場合のみ一致・不一致を判定する)
export type BirthdayCheck = "match" | "mismatch" | "unknown";

export function getBirthdayCheck(source: MergeSideState, target: MergeSideState): BirthdayCheck {
  if (!hasValue(source.birthday) || !hasValue(target.birthday)) return "unknown";
  return source.birthday === target.birthday ? "match" : "mismatch";
}

// 本人確認の根拠の強さ。LINE User IDが一致する場合のみ「強い根拠」とし、
// LINE表示名・名前の一致は根拠として扱わない
export type MergeEvidence = "line_user_id_match" | "no_line_evidence";

function effectiveLineUserId(side: MergeSideState): string | null {
  if (side.linkedContactLineUserId !== null) return side.linkedContactLineUserId;
  return hasValue(side.lineUserId) ? side.lineUserId.trim() : null;
}

export function getMergeEvidence(source: MergeSideState, target: MergeSideState): MergeEvidence {
  const sourceId = effectiveLineUserId(source);
  const targetId = effectiveLineUserId(target);
  return sourceId !== null && sourceId === targetId ? "line_user_id_match" : "no_line_evidence";
}

export const MERGE_EVIDENCE_LABELS: Record<MergeEvidence, string> = {
  line_user_id_match: "LINE User IDが一致しています(同じLINEアカウントである強い根拠)",
  no_line_evidence:
    "LINE User IDによる確認ができません。LINE表示名や名前の一致は本人確認の根拠になりません。",
};

// 確認画面で求める操作
export interface MergeConfirmRequirements {
  // 生年月日が一致しない: 理由の入力が必要
  requireReason: boolean;
  // LINE User IDで確認できない: 「照合して同じ人物と確認した」チェックが必要
  requireIdentityCheck: boolean;
  // LINE User IDで確認できない: 統合元の顧客番号の入力が必要(統合元に顧客番号がある場合)
  requireSourceCustomerNo: boolean;
}

export function getMergeConfirmRequirements(input: {
  evidence: MergeEvidence;
  birthdayCheck: BirthdayCheck;
  sourceHasCustomerNo: boolean;
  // どちらかの申込の名前・生年月日が、登録先の顧客の情報と違う(別の人の申込が登録されている可能性)
  requestMismatch?: boolean;
}): MergeConfirmRequirements {
  // LINE User IDが一致していても、申込と顧客の情報が食い違う場合は照合を求める
  const weak = input.evidence !== "line_user_id_match" || input.requestMismatch === true;
  return {
    requireReason: input.birthdayCheck === "mismatch",
    requireIdentityCheck: weak,
    requireSourceCustomerNo: weak && input.sourceHasCustomerNo,
  };
}

export const MERGE_REASON_MIN_LENGTH = 5;
export const MERGE_REASON_MAX_LENGTH = 500;

export interface MergeConfirmation {
  reason: string;
  identityChecked: boolean;
  typedSourceCustomerNo: string;
}

// 確認画面の入力が要件を満たしているか(満たしていなければ画面に出すメッセージ)。サーバー側でも同じ確認を行う
export function validateMergeConfirmation(
  requirements: MergeConfirmRequirements,
  confirmation: Partial<MergeConfirmation> | null | undefined,
  sourceCustomerNo: number | null,
): string | null {
  const input = confirmation ?? {};
  if (requirements.requireReason) {
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason.length < MERGE_REASON_MIN_LENGTH) {
      return `生年月日が一致しないため、統合する理由を${MERGE_REASON_MIN_LENGTH}文字以上で入力してください。`;
    }
    if (reason.length > MERGE_REASON_MAX_LENGTH) {
      return `理由は${MERGE_REASON_MAX_LENGTH}文字以内で入力してください。`;
    }
  }
  if (requirements.requireIdentityCheck && input.identityChecked !== true) {
    return "名前・生年月日・相談内容を照合し、同じ人物であることを確認したらチェックを入れてください。";
  }
  if (requirements.requireSourceCustomerNo) {
    const typed = typeof input.typedSourceCustomerNo === "string" ? input.typedSourceCustomerNo.trim() : "";
    if (sourceCustomerNo === null || typed !== String(sourceCustomerNo)) {
      return "確認のため、統合元の顧客番号を正しく入力してください。";
    }
  }
  return null;
}

// 確認画面に出すLINE紐づけの状態
export type LineMergeState =
  // どちらにもLINE送信者が紐づいていない
  | "none"
  // 統合元のLINE送信者を統合先へ移す
  | "move_from_source"
  // 統合先のLINE送信者をそのまま使う
  | "keep_target"
  // 両方に紐づいていて統合できない
  | "conflict";

export function getLineMergeState(source: MergeSideState, target: MergeSideState): LineMergeState {
  const sourceLinked = source.linkedContactLineUserId !== null;
  const targetLinked = target.linkedContactLineUserId !== null;
  if (sourceLinked && targetLinked) return "conflict";
  if (sourceLinked) return "move_from_source";
  if (targetLinked) return "keep_target";
  return "none";
}

// 統合先のLINE User IDが空で、統合元に値がある場合のみ、統合先へ入れる(既にある値は上書きしない)
export function willFillTargetLineUserId(source: MergeSideState, target: MergeSideState): boolean {
  return hasValue(source.lineUserId) && !hasValue(target.lineUserId);
}

export const LINE_MERGE_STATE_LABELS: Record<LineMergeState, string> = {
  none: "どちらの顧客にもLINE送信者は紐づいていません。",
  move_from_source: "統合元に紐づいているLINE送信者を、統合先へ引き継ぎます(LINEの受信履歴も統合先に表示されます)。",
  keep_target: "統合先に紐づいているLINE送信者をそのまま使います。",
  conflict: "両方の顧客にLINE送信者が紐づいています(統合できません)。",
};
