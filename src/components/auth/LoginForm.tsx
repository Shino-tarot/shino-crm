"use client";

import { useActionState } from "react";
import { signIn, SignInState } from "@/lib/auth/actions";

const INITIAL_STATE: SignInState = { error: "" };

interface LoginFormProps {
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(signIn, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-violet-600 px-4 py-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {isPending ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
