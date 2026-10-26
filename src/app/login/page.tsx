import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { sanitizeNextPath } from "@/lib/auth/adminEmails";

export const metadata: Metadata = {
  title: "ログイン | 占い師CRM",
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:py-16">
      <h1 className="text-xl font-semibold text-zinc-900">占い師CRM</h1>
      <p className="mt-1 text-sm text-zinc-500">管理者アカウントでログインしてください。</p>
      <div className="mt-6 rounded-md border border-zinc-200 bg-white p-5">
        <LoginForm nextPath={sanitizeNextPath(next)} />
      </div>
    </div>
  );
}
