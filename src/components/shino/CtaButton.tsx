"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_content"] as const;

type CtaButtonProps = {
  children: React.ReactNode;
  lineUrl: string;
};

export function CtaLink({ children, lineUrl }: CtaButtonProps) {
  return (
    <Suspense
      fallback={
        <a href={lineUrl || "#"} className="shino-cta">
          <span>{children}</span>
        </a>
      }
    >
      <CtaButton lineUrl={lineUrl}>{children}</CtaButton>
    </Suspense>
  );
}

function CtaButton({ children, lineUrl }: CtaButtonProps) {
  const searchParams = useSearchParams();
  const href = buildHref(lineUrl, searchParams);

  return (
    <a href={href} className="shino-cta">
      <span>{children}</span>
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
