import type { Metadata } from "next";
import { Cormorant, Shippori_Mincho } from "next/font/google";
import "./shino.css";

const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori-mincho",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const cormorant = Cormorant({
  variable: "--font-cormorant",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
});

const title = "紫乃｜恋愛専門 ご縁鑑定";
const description =
  "彼の本音、ご縁の流れ、復縁・片思い・音信不通のお悩みを無料で受付中。公式LINEよりご相談ください。";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/shino",
    siteName: "紫乃｜恋愛専門 ご縁鑑定",
    locale: "ja_JP",
    type: "website",
    images: ["/images/bar-hero.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/bar-hero.png"],
  },
};

export default function ShinoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`shino-theme ${shipporiMincho.variable} ${cormorant.variable} min-h-full`}
    >
      {children}
    </div>
  );
}
