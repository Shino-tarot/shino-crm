"use client";

import { useState } from "react";
import {
  HEARING_FIELDS,
  HEARING_FIELD_LABELS,
  HearingApplyEntry,
  HearingField,
  OPTIONAL_HEARING_FIELDS,
  ParseHearingResult,
  ParsedHearing,
  applySelectedHearingFields,
  parseHearingText,
  planHearingApply,
} from "@/lib/freeReadingRequests/parseHearingText";
import { formatDate, formatDateTime } from "@/lib/format";

// 取り込み元にできるLINEの受信メッセージ(会話履歴)
export interface HearingSourceMessage {
  id: string;
  body: string;
  sentAt: string;
}

interface LineHearingPasteBoxProps {
  // 今の入力内容(取り込み前の確認で比べる)
  currentValues: ParsedHearing;
  // 選んだ項目だけが渡される(選ばなかった項目・読み取れなかった項目は含まれない)
  onApply: (values: Partial<ParsedHearing>) => void;
  // LINEの受信メッセージ(顧客に紐づいている場合)。複数を選んでまとめて解析できる
  lineMessages?: HearingSourceMessage[];
}

const PLACEHOLDER = `①お名前
②生年月日
③お相手のお名前
④お相手の生年月日
⑤今、一番悩んでいること
⑥今後どうなりたいか・叶えたい未来`;

const LINE_MESSAGE_LIMIT = 30;

function displayValue(field: HearingField, value: string): string {
  if (!value) return "（空欄）";
  return field === "birthDate" || field === "partnerBirthDate" ? formatDate(value) : value;
}

// LINEのヒアリングを取り込む。解析(ルールのみ・外部送信なし)→ 確認 → 選んだ項目だけ反映、の順で行い、
// 既に入力されている内容を勝手に上書きしない(空欄の項目のみ初期状態で選択。違う内容への上書きは選んだ場合のみ)。
export function LineHearingPasteBox({ currentValues, onApply, lineMessages }: LineHearingPasteBoxProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ParseHearingResult | null>(null);
  const [entries, setEntries] = useState<HearingApplyEntry[]>([]);
  const [selected, setSelected] = useState<Set<HearingField>>(new Set());
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [appliedMessage, setAppliedMessage] = useState("");

  const recentMessages = (lineMessages ?? []).slice(-LINE_MESSAGE_LIMIT);

  function handleParse() {
    setError("");
    setAppliedMessage("");
    if (!text.trim()) {
      setError("貼り付ける内容がありません。");
      setResult(null);
      return;
    }
    const parsed = parseHearingText(text);
    if (
      parsed.matchedFields.length === 0 &&
      parsed.unparsedDateFields.length === 0 &&
      parsed.explicitlyEmptyFields.length === 0
    ) {
      setError(
        "項目を読み取れませんでした。番号(①〜⑥・1.〜6.)付き、または「お名前：〇〇」の形で書かれた回答に対応しています。番号の無い文章は推測で振り分けないため、手動で入力してください。",
      );
      setResult(null);
      return;
    }
    const plan = planHearingApply(currentValues, parsed);
    setResult(parsed);
    setEntries(plan);
    setSelected(new Set(plan.filter((entry) => entry.action === "fill").map((entry) => entry.field)));
  }

  function toggleField(field: HearingField) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function handleApply() {
    const values = applySelectedHearingFields(entries, selected);
    onApply(values);
    setAppliedMessage(`${Object.keys(values).length}件の項目を反映しました。内容を確認してから保存してください。`);
    setResult(null);
  }

  function insertSelectedMessages() {
    // 送信順(古い順)につなげて貼り付け欄に入れる。解析前に内容を確認・修正できる
    const bodies = recentMessages.filter((message) => selectedMessageIds.has(message.id)).map((m) => m.body);
    setText(bodies.join("\n"));
    setResult(null);
    setError("");
  }

  const notFound = result
    ? HEARING_FIELDS.filter(
        (field) =>
          !result.matchedFields.includes(field) &&
          !result.unparsedDateFields.includes(field) &&
          !result.explicitlyEmptyFields.includes(field),
      )
    : [];

  return (
    <div className="rounded-md border border-violet-200 bg-violet-50/60 p-4">
      <label className="block text-sm font-semibold text-zinc-700">
        LINEヒアリング貼り付け
      </label>
      <p className="mt-1 text-xs text-zinc-500">
        LINEでやり取りしたヒアリング内容をコピーして貼り付けてください。複数のメッセージに分かれていても、まとめて貼り付ければ読み取れます。
      </p>

      {recentMessages.length > 0 && (
        <details className="mt-2 rounded-md border border-zinc-200 bg-white p-2">
          <summary className="cursor-pointer text-xs font-medium text-zinc-700">
            LINEの受信メッセージから選ぶ（直近{recentMessages.length}件）
          </summary>
          <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
            {recentMessages.map((message) => (
              <li key={message.id}>
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedMessageIds.has(message.id)}
                    onChange={() =>
                      setSelectedMessageIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(message.id)) next.delete(message.id);
                        else next.add(message.id);
                        return next;
                      })
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-zinc-400">{formatDateTime(message.sentAt)}</span>
                    <span className="ml-2 line-clamp-2 whitespace-pre-wrap text-zinc-700">{message.body}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={insertSelectedMessages}
            disabled={selectedMessageIds.size === 0}
            className="mt-2 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            選んだ{selectedMessageIds.size}件を貼り付け欄に入れる
          </button>
        </details>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={PLACEHOLDER}
        className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm"
      />
      <button
        type="button"
        onClick={handleParse}
        className="mt-3 w-full rounded-md bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 sm:w-auto sm:py-2"
      >
        解析する
      </button>
      {error && <p className="mt-2 text-sm text-amber-600">{error}</p>}
      {appliedMessage && <p className="mt-2 text-sm text-green-600">{appliedMessage}</p>}

      {result && (
        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
          <p className="text-sm font-semibold text-zinc-900">読み取り結果の確認</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            反映する項目を選んでください。既に入力されている内容と違う項目は、初期状態では選ばれていません。
          </p>
          {entries.length > 0 && (
            <ul className="mt-2 space-y-2">
              {entries.map((entry) => (
                <li key={entry.field} className="rounded border border-zinc-100 p-2 text-sm">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={entry.action !== "same" && selected.has(entry.field)}
                      disabled={entry.action === "same"}
                      onChange={() => toggleField(entry.field)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-zinc-900">{HEARING_FIELD_LABELS[entry.field]}</span>
                      {entry.action === "same" && <span className="ml-2 text-xs text-zinc-400">入力済みの内容と同じ</span>}
                      {entry.action === "conflict" && (
                        <span className="ml-2 text-xs text-amber-700">入力済みの内容と違います（選ぶと上書きします）</span>
                      )}
                      {entry.action === "conflict" && (
                        <span className="mt-1 block whitespace-pre-wrap break-words text-xs text-zinc-500">
                          今の内容：{displayValue(entry.field, entry.current)}
                        </span>
                      )}
                      <span className="mt-1 block whitespace-pre-wrap break-words text-zinc-800">
                        {displayValue(entry.field, entry.next)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {result.unparsedDateFields.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              日付として読めなかった項目：{result.unparsedDateFields.map((f) => HEARING_FIELD_LABELS[f]).join("、")}（手動で入力してください）
            </p>
          )}
          {result.explicitlyEmptyFields.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              「なし」と回答された項目（空欄のまま）：{result.explicitlyEmptyFields.map((f) => HEARING_FIELD_LABELS[f]).join("、")}
            </p>
          )}
          {notFound.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              書かれていなかった項目（未判定・推測では埋めません）：
              {notFound
                .map((f) => (OPTIONAL_HEARING_FIELDS.has(f) ? `${HEARING_FIELD_LABELS[f]}は空欄で問題ありません` : HEARING_FIELD_LABELS[f]))
                .join("、")}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              取り消す
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={entries.every((entry) => entry.action === "same" || !selected.has(entry.field))}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              選んだ項目を反映する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
