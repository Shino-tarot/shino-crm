"use client";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="鑑定名・LINE表示名・本名で検索"
        className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-3 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="検索をクリア"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          ×
        </button>
      )}
    </div>
  );
}
