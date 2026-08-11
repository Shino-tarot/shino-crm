import { TaikoCtaLink } from "@/components/taiko/CtaButton";
import { HeroImage } from "@/components/taiko/HeroImage";
import { Reveal } from "@/components/taiko/Reveal";
import { WaveDivider } from "@/components/taiko/WaveDivider";

const LINE_URL = process.env.NEXT_PUBLIC_LINE_URL_TAIKO ?? "";

const WORRY_GROUPS = [
  {
    title: "恋愛",
    items: [
      "別れたあの人と復縁できるのか知りたい",
      "片思いの相手と付き合える未来があるのか知りたい",
      "今付き合っている彼と結婚できるのか知りたい",
    ],
  },
  {
    title: "仕事",
    items: [
      "転職したいけど、今より良い転職先に出会えるか不安",
      "今の会社を辞めるなら、いつ動くのが良いのか知りたい",
      "自分に向いている仕事を見つけたい",
    ],
  },
  {
    title: "お金",
    items: [
      "貯金残高を見て落ち込む日々から卒業したい",
      "毎月お金の心配をする生活から抜け出したい",
      "今より収入を増やせるチャンスがあるのか知りたい",
    ],
  },
  {
    title: "人間関係",
    items: [
      "職場の苦手な人との関係をどうしたらいいのか知りたい",
      "疎遠になった人とのご縁がまた戻るのか知りたい",
      "今の人間関係を続けるべきか、距離を置くべきか迷っている",
    ],
  },
];

export default function TaikoLandingPage() {
  return (
    <main className="mx-auto min-h-full max-w-md px-5 pb-16 pt-12 sm:max-w-lg sm:px-6">
      {/* 1. ファーストビュー */}
      <section className="text-center">
        <Reveal>
          <p className="taiko-eyebrow">累計鑑定1,000件以上｜福潮読み 無料鑑定</p>
        </Reveal>

        <Reveal delayMs={100} className="mt-5">
          <h1 className="text-2xl leading-relaxed font-bold tracking-wide sm:text-3xl">
            今のあなたに流れる
            <br />
            <span className="taiko-accent">「福の潮」</span>
            を読み解きます
          </h1>
        </Reveal>

        <Reveal delayMs={200} className="mt-8">
          <TaikoCtaLink lineUrl={LINE_URL} />
          <p className="mt-3 text-sm text-[var(--taiko-text-soft)]">
            あなたの福潮を無料で読み解きます
          </p>
        </Reveal>

        <Reveal delayMs={100} className="mt-10">
          <HeroImage />
        </Reveal>

        <Reveal delayMs={100} className="mt-10">
          <div className="text-base leading-loose sm:text-lg">
            <p>
              頑張っているのに、
              <br />
              なぜかうまくいかない。
            </p>
            <p className="mt-6">恋愛、仕事、お金、人間関係。</p>
            <p className="mt-6">
              先のことが見えないと、
              <br />
              不安になりますよね。
            </p>
            <p className="mt-6">
              でも、今うまくいっていないからといって、
              <br />
              この先もずっと同じとは限りません。
            </p>
            <p className="mt-6">
              人生には海と同じように、
              <br />
              流れが満ちる時も、
              <br />
              潮目が変わる時もあります。
            </p>
            <p className="mt-6">
              あなたが今どんな<span className="taiko-accent">「福潮」</span>
              の中にいるのか。
            </p>
            <p className="mt-6">
              そして、
              <br />
              この先どんな流れが巡ってくるのか。
            </p>
            <p className="mt-6">心を込めて読み解きます。</p>
          </div>
        </Reveal>
      </section>

      {/* 2. 具体的な悩み提示 */}
      <Reveal className="mt-24">
        <section aria-labelledby="worries-heading" className="text-center">
          <h2 id="worries-heading" className="text-xl font-bold tracking-wide sm:text-2xl">
            こんなこと、知りたくありませんか？
          </h2>

          <div className="mt-10 space-y-10 text-left">
            {WORRY_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="taiko-eyebrow">{group.title}</p>
                <ul className="taiko-worry-list mt-4 space-y-4">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 pb-4 text-base leading-relaxed"
                    >
                      <span aria-hidden="true" className="taiko-worry-check mt-0.5">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-10 leading-loose">
            ひとつでも気になることがあれば、
            <br />
            今のあなたに流れている福潮を読み解いてみませんか？
          </p>

          <div className="mt-8">
            <TaikoCtaLink lineUrl={LINE_URL} />
          </div>
        </section>
      </Reveal>

      {/* 3. 福潮読みとは */}
      <Reveal className="mt-24">
        <section aria-labelledby="about-fukushio-heading" className="text-center">
          <div className="flex justify-center text-[var(--taiko-gold)]">
            <WaveDivider />
          </div>

          <h2
            id="about-fukushio-heading"
            className="mt-4 text-xl font-bold tracking-wide sm:text-2xl"
          >
            福潮読みとは？
          </h2>

          <div className="mt-8 text-base leading-loose text-[var(--taiko-text-soft)] sm:text-lg">
            <p>
              人生には、海の潮のように
              <br />
              満ちる時、
              <br />
              引く時、
              <br />
              潮目が変わる時
              <br />
              があります。
            </p>
            <p className="mt-6">
              頑張っているのに結果が出ない時も、
              <br />
              恋愛や仕事が思うように進まない時も、
            </p>
            <p className="mt-6 text-[var(--taiko-text)]">
              ただ「運が悪い」のではなく、
              <br />
              次の流れへ切り替わる途中
              <br />
              なのかもしれません。
            </p>
          </div>

          <div className="mt-8 text-left">
            <p className="text-center leading-loose">福潮読みでは、</p>
            <ul className="taiko-worry-list mt-4 space-y-4">
              {[
                "今の運気の流れ",
                "これから訪れる潮目の変化",
                "幸運の流れに乗るために意識したいこと",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 pb-4 text-base leading-relaxed"
                >
                  <span aria-hidden="true" className="taiko-worry-check mt-0.5">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center leading-loose">
              を、あなたのお悩みに合わせて読み解きます。
            </p>
          </div>
        </section>
      </Reveal>

      {/* 4. 鯛子について */}
      <Reveal className="mt-24">
        <section aria-labelledby="about-taiko-heading" className="text-center">
          <h2 id="about-taiko-heading" className="text-xl font-bold tracking-wide sm:text-2xl">
            はじめまして、鯛子です。
          </h2>
          <p className="taiko-eyebrow mt-4">福を届ける占い師</p>

          <div className="mt-8 text-base leading-loose sm:text-lg">
            <p>
              昔から鯛は、
              <br />
              幸運・繁栄・良縁・出世・生命力
              <br />
              を運ぶ縁起物として大切にされてきました。
            </p>
            <p className="mt-6">
              私は、その福を人へ届ける役目を授かり、
              <br />
              これまで累計1,000名以上の方の
            </p>
            <p className="mt-6 text-[var(--taiko-text-soft)]">
              恋愛
              <br />
              仕事
              <br />
              金運
              <br />
              人間関係
            </p>
            <p className="mt-6">を読み解いてきました。</p>
            <p className="mt-6">
              私が大切にしているのは、
              <br />
              未来をただ「良い・悪い」で終わらせないこと。
            </p>
            <p className="mt-6">
              今が引き潮なら、
              <br />
              <br />
              いつ、
              <br />
              どこから流れが変わっていくのか。
            </p>
            <p className="mt-6">
              そして、
              <br />
              幸運を迎えるために
              <br />
              今のあなたに何ができるのか。
            </p>
            <p className="mt-6">そこまで心を込めてお伝えします。</p>
            <p className="mt-6">
              福の流れを読み、幸運を引き寄せるお手伝いができたら嬉しいです。
            </p>
          </div>
        </section>
      </Reveal>

      {/* 5. 最終CTA */}
      <Reveal className="mt-24 text-center" delayMs={100}>
        <div className="flex justify-center text-[var(--taiko-gold)]">
          <WaveDivider />
        </div>

        <h2 className="mt-4 text-xl font-bold tracking-wide sm:text-2xl">
          あなたの福は、
          <br />
          ここから巡り始めます
        </h2>

        <div className="mt-8 text-base leading-loose sm:text-lg">
          <p>
            今は先が見えなくても、
            <br />
            大丈夫ですよ。
          </p>
          <p className="mt-6">潮はずっと同じ場所に留まりません。</p>
          <p className="mt-6">
            あなたの人生にも、
            <br />
            新しい流れが巡ってくる時があります。
          </p>
          <p className="mt-6">
            今のあなたは、
            <br />
            どんな福潮の中にいるのか。
          </p>
          <p className="mt-6">
            その流れを、
            <br />
            一緒に読み解いてみませんか？
          </p>
        </div>

        <p className="taiko-eyebrow mt-8">福潮読み｜無料鑑定受付中</p>

        <div className="mt-8">
          <TaikoCtaLink lineUrl={LINE_URL} />
        </div>
      </Reveal>
    </main>
  );
}
