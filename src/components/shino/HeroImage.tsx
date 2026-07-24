"use client";

import Image from "next/image";
import { useState } from "react";

export function HeroImage() {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="shino-hero-image">
      {!hasError && (
        <Image
          src="/images/bar-hero.png"
          alt="紫乃の会員制バーの店内"
          fill
          priority
          sizes="(min-width: 640px) 640px, 100vw"
          className="shino-hero-image-img"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}
