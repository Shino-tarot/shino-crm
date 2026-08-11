export function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP");
}

export function formatDateTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

// input type="date"にそのまま渡せるYYYY-MM-DD形式の「今日」を返す。
// サーバー実行環境のタイムゾーンに関わらず日本時間の日付で揃えるため、
// Intlのtimezone指定でJSTの日付を取得する。
export function getTodayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// timestamptz(ISO文字列)を、input type="datetime-local"にそのまま渡せる
// "YYYY-MM-DDTHH:mm"形式(日本時間)へ変換する。
export function toDateTimeLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// input type="datetime-local"の値("YYYY-MM-DDTHH:mm"、日本時間として入力された値)を
// DB保存用のISO文字列(UTC)へ変換する。不正な形式・空文字はnullを返す。
export function fromJstDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
