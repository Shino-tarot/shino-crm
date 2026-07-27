"use client";

import { useState } from "react";
import {
  ParsedHearing,
  parseHearingText,
} from "@/lib/freeReadingRequests/parseHearingText";

interface LineHearingPasteBoxProps {
  onParsed: (parsed: ParsedHearing) => void;
}

const PLACEHOLDER = `①あなたのお名前
②あなたの生年月日
③お相手のお名前
④お相手の生年月日
⑤今のお悩み
⑥理想の未来`;

export function LineHearingPasteBox({ onParsed }: LineHearingPasteBoxProps) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{
    tone: "success" | "warning";
    text: string;
  } | null>(null);

  function handleParse() {
    if (!text.trim()) {
      setMessage({ tone: "warning", text: "貼り付ける内容がありません。" });
      return;
    }

    const { parsed, matchedFields, unparsedDateFields } =
      parseHearingText(text);

    if (matchedFields.length === 0) {
      setMessage({
        tone: "warning",
        text: "項目を読み取れませんでした。①〜⑥の書式に沿って貼り付けてください。",
      });
      return;
    }

    onParsed(parsed);

    const notes = [`${matchedFields.length}件の項目を反映しました。`];
    if (unparsedDateFields.length > 0) {
      notes.push(
        "生年月日を自動認識できなかった項目があります。手動で入力してください。",
      );
    }
    setMessage({
      tone: unparsedDateFields.length > 0 ? "warning" : "success",
      text: notes.join(" "),
    });
  }

  return (
    <div className="rounded-md border border-violet-200 bg-violet-50/60 p-4">
      <label className="block text-sm font-semibold text-zinc-700">
        LINEヒアリング貼り付け
      </label>
      <p className="mt-1 text-xs text-zinc-500">
        LINEでやり取りしたヒアリング内容（①〜⑥の書式）をコピーして貼り付けてください。
      </p>
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
      {message && (
        <p
          className={`mt-2 text-sm ${
            message.tone === "success" ? "text-green-600" : "text-amber-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
