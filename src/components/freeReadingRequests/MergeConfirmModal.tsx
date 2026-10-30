"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { MergePreviewDetails } from "@/components/freeReadingRequests/MergePreviewDetails";
import {
  MERGE_BIRTHDAY_MISMATCH_MESSAGE,
  MERGE_BLOCK_MESSAGES,
  MERGE_EVIDENCE_LABELS,
  MERGE_REASON_MAX_LENGTH,
  MergeConfirmation,
  validateMergeConfirmation,
} from "@/lib/customers/mergeRules";
import { MergePreview } from "@/types/customerMerge";

interface MergeConfirmModalProps {
  preview: Exclude<MergePreview, { kind: "already_same" }>;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (confirmation: MergeConfirmation) => void;
}

// 統合前の確認画面。2人を並べて比べ、根拠が弱い場合は追加の確認操作を求める。
//   - LINE User IDで確認できない: 「照合して同じ人物と確認した」チェック＋統合元の顧客番号の入力
//   - 生年月日が一致しない: 理由の入力(原則統合しない。理由は統合の記録に残る)
//   - 統合できない場合(別アカウント・非表示・LINEの競合): 理由のみ表示し、実行ボタンを出さない
// 同じ確認はサーバー側(linkRequestsAsSameCustomer)とDB関数でも行う。
export function MergeConfirmModal({ preview, isSubmitting, onCancel, onConfirm }: MergeConfirmModalProps) {
  const [reason, setReason] = useState("");
  const [identityChecked, setIdentityChecked] = useState(false);
  const [typedSourceCustomerNo, setTypedSourceCustomerNo] = useState("");

  const confirmation: MergeConfirmation = { reason, identityChecked, typedSourceCustomerNo };
  const validationError = validateMergeConfirmation(
    preview.requirements,
    confirmation,
    preview.source.customerNo,
  );
  const close = () => {
    if (!isSubmitting) onCancel();
  };

  if (preview.blockReason) {
    return (
      <Modal title="同じ顧客として紐付けできません" onClose={close}>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {MERGE_BLOCK_MESSAGES[preview.blockReason]}
        </p>
        <div className="mt-3 text-sm text-zinc-600">
          <MergePreviewDetails preview={preview} />
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={close} className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
            閉じる
          </button>
        </div>
      </Modal>
    );
  }

  const strongEvidence = preview.evidence === "line_user_id_match";

  return (
    <Modal title="同じ顧客として紐付ける前の確認" onClose={close}>
      <div className="space-y-3 text-sm text-zinc-600">
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            strongEvidence ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
          }`}
        >
          {MERGE_EVIDENCE_LABELS[preview.evidence]}
        </p>
        {preview.birthdayCheck === "mismatch" && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {MERGE_BIRTHDAY_MISMATCH_MESSAGE}
          </p>
        )}

        <MergePreviewDetails preview={preview} />

        {preview.requirements.requireReason && (
          <label className="block">
            <span className="text-sm font-medium text-zinc-900">統合する理由（生年月日が一致しないため必須）</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MERGE_REASON_MAX_LENGTH}
              rows={3}
              placeholder="例: 本人にLINEで確認し、生年月日の入力ミスと判明した"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
          </label>
        )}
        {preview.requirements.requireIdentityCheck && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={identityChecked}
              onChange={(e) => setIdentityChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-zinc-900">
              名前・生年月日・相談内容を照合し、同じ人物であることを確認しました（LINE表示名が同じだけでは同一人物と判断しません）。
            </span>
          </label>
        )}
        {preview.requirements.requireSourceCustomerNo && (
          <label className="block">
            <span className="text-sm font-medium text-zinc-900">
              確認のため、統合元の顧客番号（No.{preview.source.customerNo}）を入力してください
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={typedSourceCustomerNo}
              onChange={(e) => setTypedSourceCustomerNo(e.target.value)}
              className="mt-1 w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              aria-label="統合元の顧客番号"
            />
          </label>
        )}

        <p>
          <strong>別人を誤って統合していないか、必ずご確認ください。</strong>
          統合元の顧客は削除されず、非表示になって統合先が記録されます(元に戻すには管理者による対応が必要です)。
        </p>
        {validationError && <p className="text-xs text-zinc-500">{validationError}</p>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={close}
          disabled={isSubmitting}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={() => onConfirm(confirmation)}
          disabled={isSubmitting || validationError !== null}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isSubmitting ? "処理中..." : "紐付ける"}
        </button>
      </div>
    </Modal>
  );
}
