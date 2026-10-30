"use client";

import { useState } from "react";
import {
  HearingSourceMessage,
  LineHearingPasteBox,
} from "@/components/freeReadingRequests/LineHearingPasteBox";
import { ParsedHearing } from "@/lib/freeReadingRequests/parseHearingText";

interface LineHearingImportAccordionProps {
  currentValues: ParsedHearing;
  onApply: (values: Partial<ParsedHearing>) => void;
  lineMessages?: HearingSourceMessage[];
}

// 普段カルテを閲覧するだけの時に画面上部を占有しないよう、折りたたみにして
// 初期状態は閉じておく。
export function LineHearingImportAccordion({
  currentValues,
  onApply,
  lineMessages,
}: LineHearingImportAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        LINEヒアリングを取り込む
        <span className="text-xs text-zinc-400">{isOpen ? "閉じる ▲" : "開く ▼"}</span>
      </button>

      {isOpen && (
        <div className="mt-3">
          <LineHearingPasteBox currentValues={currentValues} onApply={onApply} lineMessages={lineMessages} />
        </div>
      )}
    </section>
  );
}
