"use client";

import Image from "next/image";
import { useState } from "react";

// 現時点では public/images/taiko-hero.png は未配置。
// 画像が用意されるまではCSSのグラデーション(taiko.css .taiko-hero-image)が
// そのまま背景として見えるため、レイアウトが崩れることはない。
export function HeroImage() {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="taiko-hero-image">
      {!hasError && (
        <Image
          src="/images/taiko-hero.png"
          alt="福潮読み 鯛子"
          fill
          priority
          sizes="(min-width: 640px) 640px, 100vw"
          className="taiko-hero-image-img"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}
