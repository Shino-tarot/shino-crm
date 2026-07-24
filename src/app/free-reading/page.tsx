import type { Metadata } from "next";
import { FreeReadingForm } from "@/components/freeReading/FreeReadingForm";

export const metadata: Metadata = {
  title: "無料鑑定のお申し込み",
  description: "無料鑑定のお申し込みはこちらのフォームからお願いします。",
};

export default function FreeReadingPage() {
  return (
    <div className="mx-auto min-h-full max-w-md px-4 py-8">
      <h1 className="text-lg font-semibold text-zinc-900">無料鑑定のお申し込み</h1>
      <p className="mt-2 text-sm text-zinc-500">
        必要事項をご入力の上、送信してください。
      </p>
      <div className="mt-6">
        <FreeReadingForm />
      </div>
    </div>
  );
}
