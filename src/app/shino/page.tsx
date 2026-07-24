import { CtaLink } from "@/components/shino/CtaButton";
import { HeroImage } from "@/components/shino/HeroImage";
import { Reveal } from "@/components/shino/Reveal";

const LINE_URL = process.env.NEXT_PUBLIC_LINE_URL ?? "";

const WORRIES = [
  "彼の気持ちが分からない",
  "音信不通になってしまった",
  "復縁できる可能性を知りたい",
  "この恋を諦めるべきか迷っている",
  "ご縁がまだ残っているのか知りたい",
];

const BENEFITS = [
  "彼が今あなたをどう想っているのか",
  "お二人のご縁が今どんな状態なのか",
  "ご縁を停滞させている本当の原因",
];

export default function ShinoLandingPage() {
  return (
    <main className="mx-auto min-h-full max-w-md px-6 pb-16 pt-14 sm:max-w-lg">
      {/* ファーストビュー */}
      <section className="text-center">
        <Reveal>
          <p className="shino-latin text-xs font-light tracking-[0.28em] text-[var(--shino-gold-deep)] sm:text-sm">
            Shino — Private Members Bar
          </p>
        </Reveal>

        <Reveal delayMs={100}>
          <h1 className="shino-serif mt-5 text-2xl leading-relaxed tracking-wide sm:text-3xl">
            紫乃の会員制バーへようこそ
          </h1>
        </Reveal>

        <Reveal delayMs={200} className="mt-8">
          <HeroImage />
        </Reveal>

        <Reveal delayMs={100} className="mt-10">
          <p className="shino-serif text-lg leading-loose sm:text-xl">
            今夜は、
            <br />
            <span className="text-[var(--shino-gold-deep)]">
              あなたの恋の話を聞かせて。
            </span>
            <br />
            <br />
            彼の気持ちと、
            <br />
            <span className="text-[var(--shino-gold-deep)]">
              今のお二人のご縁の流れ
            </span>
            を
            <br />
            視えたままお伝えするわね。
          </p>
        </Reveal>

        <Reveal delayMs={100} className="mt-10">
          <CtaLink lineUrl={LINE_URL}>無料でご縁を視てもらう</CtaLink>
        </Reveal>
      </section>

      {/* こんなお悩みはありませんか？ */}
      <Reveal className="mt-24">
        <section aria-labelledby="worries-heading" className="text-center">
          <h2
            id="worries-heading"
            className="shino-serif text-xl tracking-wide sm:text-2xl"
          >
            こんなお悩みはありませんか？
          </h2>

          <ul className="mt-8 space-y-4 text-left">
            {WORRIES.map((worry) => (
              <li
                key={worry}
                className="flex items-start gap-3 border-b border-[var(--shino-hairline)] pb-4 text-base leading-relaxed"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 text-[var(--shino-gold)]"
                >
                  ✓
                </span>
                <span>{worry}</span>
              </li>
            ))}
          </ul>

          <p className="shino-serif mt-8 leading-loose text-[var(--shino-text-soft)]">
            そんな想いを抱えた方から、
            <br />
            毎日たくさんのご相談をいただいています。
          </p>
        </section>
      </Reveal>

      {/* 無料鑑定で分かること */}
      <Reveal className="mt-24">
        <section aria-labelledby="benefits-heading" className="text-center">
          <h2
            id="benefits-heading"
            className="shino-serif text-xl tracking-wide sm:text-2xl"
          >
            無料鑑定で分かること
          </h2>

          <ul className="mt-8 space-y-4 text-left">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit}
                className="flex items-start gap-3 border-b border-[var(--shino-hairline)] pb-4 text-base leading-relaxed"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 text-[var(--shino-gold)]"
                >
                  ✓
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <p className="shino-serif mt-8 leading-loose">
            ここまで無料で視させてもらっているわ。
          </p>
        </section>
      </Reveal>

      {/* 説明文 */}
      <Reveal className="mt-24">
        <section className="text-center">
          <p className="shino-serif leading-loose text-[var(--shino-text-soft)]">
            「曖昧な関係のまま進展しない。」
            <br />
            <br />
            「彼からの連絡が止まってしまった。」
          </p>

          <p className="shino-serif mt-8 leading-loose">
            そんな恋には、
            <br />
            必ず理由があるの。
          </p>

          <p className="shino-serif mt-8 leading-loose text-[var(--shino-text-soft)]">
            彼の本音も、
            <br />
            ご縁の流れも、
            <br />
            <br />
            表面だけでは見えないもの。
          </p>

          <p className="shino-serif mt-8 leading-loose">
            だからこそ私は、
            <br />
            <br />
            あなたが前へ進むために必要なことを、
            <br />
            視えたまま正直にお伝えしているわ。
          </p>

          <p className="shino-serif mt-8 leading-loose">
            まずは今のお二人のご縁を、
            <br />
            一緒に視てみましょう。
          </p>
        </section>
      </Reveal>

      {/* CTA 2 */}
      <Reveal className="mt-16 text-center" delayMs={100}>
        <CtaLink lineUrl={LINE_URL}>無料でご縁を視てもらう</CtaLink>

        <p className="shino-latin mt-6 text-xs font-light tracking-[0.2em] text-[var(--shino-text-soft)]">
          公式LINEにて一対一で受付
        </p>
      </Reveal>
    </main>
  );
}
