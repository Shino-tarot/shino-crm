// LINEでコピーしたヒアリング文章(①〜⑥の書式)を各項目に振り分けるパーサー。
//
// 想定する貼り付け例:
//   ①あなたのお名前
//   山田花子
//   ②あなたの生年月日
//   1990/5/3
//   ③お相手のお名前
//   田中太郎
//   ④お相手の生年月日
//   1988年12月20日
//   ⑤今のお悩み
//   彼と最近すれ違いが多くて…
//   ⑥理想の未来
//   円満に結婚したい
//
// 見出し行(①〜⑥)自体は質問文なので値として扱わず、次の見出しが現れるまでの
// 行を値として取り込む。同じ行に見出しと回答が並んでいる場合(「①お名前:山田花子」等)
// にも対応する。

export interface ParsedHearing {
  name: string;
  birthDate: string;
  partnerName: string;
  partnerBirthDate: string;
  content: string;
  idealFuture: string;
}

export interface ParseHearingResult {
  parsed: ParsedHearing;
  matchedFields: (keyof ParsedHearing)[];
  unparsedDateFields: (keyof ParsedHearing)[];
}

const DATE_FIELDS: ReadonlySet<keyof ParsedHearing> = new Set([
  "birthDate",
  "partnerBirthDate",
]);

const MARKERS: { field: keyof ParsedHearing; circled: string; digit: string }[] = [
  { field: "name", circled: "①", digit: "1" },
  { field: "birthDate", circled: "②", digit: "2" },
  { field: "partnerName", circled: "③", digit: "3" },
  { field: "partnerBirthDate", circled: "④", digit: "4" },
  { field: "content", circled: "⑤", digit: "5" },
  { field: "idealFuture", circled: "⑥", digit: "6" },
];

// マーカーと回答が同じ行にある場合(「①あなたのお名前：山田花子」等)、
// 質問文のラベル部分だけを取り除いて回答部分だけを残すためのキーワード。
// 長い候補から先に取り除くことで「お名前」等の部分一致による誤爆を避ける。
const LABEL_KEYWORDS: Record<keyof ParsedHearing, string[]> = {
  name: ["あなたのお名前", "ご相談者様のお名前", "お名前", "名前"],
  birthDate: ["あなたの生年月日", "ご相談者様の生年月日", "生年月日"],
  partnerName: ["お相手のお名前", "お相手の名前", "相手の名前", "お名前", "名前"],
  partnerBirthDate: ["お相手の生年月日", "相手の生年月日", "生年月日"],
  content: ["今のお悩み", "今悩んでいること", "お悩み", "悩み"],
  idealFuture: ["理想の未来", "どうなっていたら理想的か", "理想"],
};

function stripLabelKeyword(field: keyof ParsedHearing, text: string): string {
  let result = text;
  for (const keyword of LABEL_KEYWORDS[field]) {
    if (result.startsWith(keyword)) {
      result = result.slice(keyword.length);
      break;
    }
  }
  return result.replace(/^[\s:：\-—>→]+/, "").trim();
}

function matchMarker(
  line: string,
): { field: keyof ParsedHearing; markerLength: number } | null {
  const trimmed = line.trim();
  for (const marker of MARKERS) {
    if (trimmed.startsWith(marker.circled)) {
      return { field: marker.field, markerLength: marker.circled.length };
    }
    const digitMatch = trimmed.match(/^(\d)[.)、．:：]\s*/);
    if (digitMatch && digitMatch[1] === marker.digit) {
      return { field: marker.field, markerLength: digitMatch[0].length };
    }
  }
  return null;
}

function toIsoDate(year: string, month: string, day: string): string {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return "";
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function normalizeDateString(input: string): string {
  const text = input.trim();

  let match = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (match) return toIsoDate(match[1], match[2], match[3]);

  match = text.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (match) return toIsoDate(match[1], match[2], match[3]);

  return "";
}

export function parseHearingText(raw: string): ParseHearingResult {
  const lines = raw.split(/\r\n|\r|\n/);

  const markerLines: {
    field: keyof ParsedHearing;
    lineIndex: number;
    markerLength: number;
  }[] = [];

  lines.forEach((line, lineIndex) => {
    const match = matchMarker(line);
    if (match) {
      markerLines.push({
        field: match.field,
        lineIndex,
        markerLength: match.markerLength,
      });
    }
  });

  const parsed: ParsedHearing = {
    name: "",
    birthDate: "",
    partnerName: "",
    partnerBirthDate: "",
    content: "",
    idealFuture: "",
  };
  const matchedFields: (keyof ParsedHearing)[] = [];
  const unparsedDateFields: (keyof ParsedHearing)[] = [];

  markerLines.forEach((entry, i) => {
    const nextLineIndex = markerLines[i + 1]?.lineIndex ?? lines.length;
    const restText = lines
      .slice(entry.lineIndex + 1, nextLineIndex)
      .join("\n")
      .trim();
    const inlineRemainder = lines[entry.lineIndex]
      .trim()
      .slice(entry.markerLength)
      .replace(/^[\s:：\-—>→]+/, "")
      .trim();
    const inlineText = stripLabelKeyword(entry.field, inlineRemainder);
    const value = restText || inlineText;

    if (!value) return;

    if (DATE_FIELDS.has(entry.field)) {
      const normalized = normalizeDateString(value);
      if (normalized) {
        parsed[entry.field] = normalized;
        matchedFields.push(entry.field);
      } else {
        unparsedDateFields.push(entry.field);
      }
      return;
    }

    parsed[entry.field] = value;
    matchedFields.push(entry.field);
  });

  return { parsed, matchedFields, unparsedDateFields };
}
