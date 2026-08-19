"use client";

import { Suspense, useEffect, useState } from "react";
import { CtaLabel, useTaikoCtaHref } from "@/components/taiko/CtaButton";

// ファーストビューの通常CTA直後に置かれるセンチネル要素のid。
// このIDはpage.tsx側で1箇所だけ描画される。
const FIRST_CTA_SENTINEL_ID = "taiko-first-cta-sentinel";

type StickyCtaProps = {
  lineUrl: string;
};

export function StickyCta({ lineUrl }: StickyCtaProps) {
  return (
    <Suspense fallback={null}>
      <StickyCtaInner lineUrl={lineUrl} />
    </Suspense>
  );
}

function StickyCtaInner({ lineUrl }: StickyCtaProps) {
  const href = useTaikoCtaHref(lineUrl);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(FIRST_CTA_SENTINEL_ID);
    if (!sentinel) return;

    // ファーストビューの通常CTAが画面上端より上へ通り過ぎたタイミングでのみ表示する。
    // (まだ画面下方にあり表示前の状態と区別するため top < 0 も条件に含める)
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`taiko-sticky-cta ${visible ? "taiko-sticky-cta-visible" : ""}`}
    >
      <a
        href={href}
        className="taiko-cta taiko-cta-sticky"
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
      >
        <CtaLabel />
        <span aria-hidden="true" className="taiko-cta-arrow">
          ＞
        </span>
      </a>
    </div>
  );
}
