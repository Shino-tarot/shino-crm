"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_content"] as const;

type TaikoCtaLinkProps = {
  lineUrl: string;
};

// CTA文言はLP内で統一する必要があるため、呼び出し側で個別に指定させず
// コンポーネント側に固定する(表記ゆれ防止)。ブラウザ幅による自動改行に
// 任せず、必ず2行(視てもらう、で3行目に割れない)になるようbrで明示する。
function CtaLabel() {
  return (
    <span>
      今とこれからの流れを
      <br />
      無料で視てもらう
    </span>
  );
}

export function TaikoCtaLink({ lineUrl }: TaikoCtaLinkProps) {
  return (
    <Suspense
      fallback={
        <a href={lineUrl || "#"} className="taiko-cta">
          <CtaLabel />
        </a>
      }
    >
      <TaikoCtaButton lineUrl={lineUrl} />
    </Suspense>
  );
}

function TaikoCtaButton({ lineUrl }: TaikoCtaLinkProps) {
  const searchParams = useSearchParams();
  const href = buildHref(lineUrl, searchParams);

  return (
    <a href={href} className="taiko-cta">
      <CtaLabel />
    </a>
  );
}

function buildHref(
  lineUrl: string,
  searchParams: ReturnType<typeof useSearchParams>,
) {
  if (!lineUrl) return "#";

  const forwarded = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const value = searchParams.get(key);
    if (value) forwarded.set(key, value);
  }
  if ([...forwarded.keys()].length === 0) return lineUrl;

  const separator = lineUrl.includes("?") ? "&" : "?";
  return `${lineUrl}${separator}${forwarded.toString()}`;
}
