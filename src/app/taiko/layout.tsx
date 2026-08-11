import type { Metadata } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./taiko.css";

const zenMaruGothic = Zen_Maru_Gothic({
  variable: "--font-zen-maru-gothic",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const title = "福潮読み無料鑑定｜今とこれからの流れを読み解きます";
const description =
  "恋愛・仕事・金運・人間関係。今あなたに流れている「福の潮」と、これから訪れる流れを福潮読みで読み解きます。累計鑑定1,000件以上。";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/taiko",
    siteName: "福潮読み｜鯛子",
    locale: "ja_JP",
    type: "website",
    images: ["/images/taiko-hero.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/taiko-hero.png"],
  },
};

export default function TaikoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`taiko-theme taiko-font ${zenMaruGothic.variable} min-h-full`}
    >
      {children}
    </div>
  );
}
