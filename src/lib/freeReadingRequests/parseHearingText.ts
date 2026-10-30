// LINEでコピーしたヒアリング文章を、6項目(①お名前 ②生年月日 ③お相手のお名前 ④お相手の生年月日
// ⑤今、一番悩んでいること ⑥今後どうなりたいか・叶えたい未来)に振り分けるパーサー。
// ルールだけで抽出する(外部のAIには送らない)。DBに依存しない純粋な関数のみ(単体テストの対象)。
//
// 対応する書き方:
//   - 番号付き: ①〜⑥ / 1. 1) 1、 1： (1) （１） Q1 など(全角数字も可)
//       見出し行は質問文なので値として扱わず、次の見出しまでの行を値として取り込む。
//       同じ行に見出しと回答が並ぶ場合(「①お名前:山田花子」等)にも対応する。
//       番号は1→6の順に増えるものだけを見出しとして扱う(回答の中の「1. 〜」の箇条書きを見出しと誤認しない)。
//       トーク全体をコピーした場合に多い「鯛子が送った質問(①〜⑥)→お客様の回答(①〜⑥)」のように
//       同じ書式の①が再び現れたら新しい回答のまとまりとみなし、回答が最も多く読み取れたまとまりを採用する
//       (同数なら後のもの。質問だけのまとまりは回答が無いため選ばれない)。
//   - 番号なしの「お名前：山田花子」のような「項目名＋コロン」の行(番号付きの見出しが1つも無い場合のみ)
//   - 複数のメッセージに分かれた回答: メッセージをつなげてから解析する(parseHearingMessages)
//       LINEのトーク履歴をコピーしたときの「時刻<TAB>送信者<TAB>本文」の形式と日付の見出し行は取り除く。
//
// 補完しないこと:
//   - 書かれていない項目は空のまま(推測で埋めない)。番号の無い自由文は「未判定」として扱う
//   - ③④(お相手)は任意項目。恋愛以外の相談では空欄・「なし」でも正常な回答として扱う
//   - 生年月日として読めない値は入れず、未認識として知らせる

export interface ParsedHearing {
  name: string;
  birthDate: string;
  partnerName: string;
  partnerBirthDate: string;
  content: string;
  idealFuture: string;
}

export type HearingField = keyof ParsedHearing;

export interface ParseHearingResult {
  parsed: ParsedHearing;
  // 値を読み取れた項目
  matchedFields: HearingField[];
  // 生年月日の項目に回答はあったが、日付として読めなかった項目
  unparsedDateFields: HearingField[];
  // 「なし」等と明示的に回答された任意項目(③④)。値は空のまま
  explicitlyEmptyFields: HearingField[];
}

export const HEARING_FIELDS: HearingField[] = [
  "name",
  "birthDate",
  "partnerName",
  "partnerBirthDate",
  "content",
  "idealFuture",
];

export const HEARING_FIELD_LABELS: Record<HearingField, string> = {
  name: "①お名前",
  birthDate: "②生年月日",
  partnerName: "③お相手のお名前（任意）",
  partnerBirthDate: "④お相手の生年月日（任意）",
  content: "⑤今、一番悩んでいること",
  idealFuture: "⑥今後どうなりたいか・叶えたい未来",
};

// 恋愛以外の相談では空欄でよい項目
export const OPTIONAL_HEARING_FIELDS: ReadonlySet<HearingField> = new Set(["partnerName", "partnerBirthDate"]);

const DATE_FIELDS: ReadonlySet<HearingField> = new Set(["birthDate", "partnerBirthDate"]);

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥"];

// 見出しと回答が同じ行にある場合に、質問文のラベル部分だけを取り除くためのキーワード。
// 長い候補から先に取り除くことで「お名前」等の部分一致による誤爆を避ける。
const LABEL_KEYWORDS: Record<HearingField, string[]> = {
  name: ["あなたのお名前", "ご相談者様のお名前", "お名前", "名前"],
  birthDate: ["あなたの生年月日", "ご相談者様の生年月日", "生年月日"],
  partnerName: ["お相手のお名前", "お相手の名前", "相手の名前", "お名前", "名前"],
  partnerBirthDate: ["お相手の生年月日", "相手の生年月日", "生年月日"],
  content: [
    "今、一番悩んでいること",
    "今一番悩んでいること",
    "一番悩んでいること",
    "今悩んでいること",
    "今のお悩み",
    "お悩み",
    "悩み",
  ],
  idealFuture: [
    "今後どうなりたいか・叶えたい未来",
    "今後どうなりたいか、叶えたい未来",
    "今後どうなりたいか",
    "叶えたい未来",
    "どうなっていたら理想的か",
    "理想の未来",
    "理想",
  ],
};

// 番号なしの「項目名：回答」行を見分けるための項目名(誤認を避けるため、より具体的な項目を先に判定する)
const LABEL_LINE_ORDER: HearingField[] = [
  "partnerBirthDate",
  "partnerName",
  "birthDate",
  "name",
  "content",
  "idealFuture",
];
const LABEL_LINE_KEYWORDS: Record<HearingField, string[]> = {
  partnerBirthDate: ["お相手の生年月日", "相手の生年月日"],
  partnerName: ["お相手のお名前", "お相手の名前", "相手の名前"],
  birthDate: ["あなたの生年月日", "ご相談者様の生年月日", "生年月日"],
  name: ["あなたのお名前", "ご相談者様のお名前", "お名前"],
  content: LABEL_KEYWORDS.content,
  idealFuture: LABEL_KEYWORDS.idealFuture,
};

// ③④で「お相手はいない」ことを示す回答(値は空のまま、明示的な回答として扱う)
const EMPTY_ANSWER_PATTERN = /^(なし|無し|ナシ|特になし|とくになし|特に無し|いない|いません|おりません|該当なし|ー+|－+|-+|—+|×)[。．.！!]?$/;

// 全角の数字・記号を半角に直す(番号・日付の判定用)
function toHalfWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, ".")
    .replace(/[／]/g, "/")
    .replace(/[－]/g, "-")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")");
}

function stripLabelKeyword(field: HearingField, text: string): string {
  let result = text;
  for (const keyword of LABEL_KEYWORDS[field]) {
    if (result.startsWith(keyword)) {
      result = result.slice(keyword.length);
      break;
    }
  }
  // 「（任意）」などの補足と、区切り記号を取り除く
  return result
    .replace(/^\s*[（(][^）)]{0,10}[）)]/, "")
    .replace(/^[\s:：\-—>→?？]+/, "")
    .trim();
}

// 行頭の番号(1〜6)を読み取る。番号と、番号部分の長さ(元の行での文字数)を返す
type MarkerStyle = "circled" | "digit";

function matchMarker(line: string): { number: number; markerLength: number; style: MarkerStyle } | null {
  const leading = line.length - line.trimStart().length;
  const trimmed = line.trimStart();
  const circledIndex = CIRCLED.findIndex((c) => trimmed.startsWith(c));
  if (circledIndex >= 0) return { number: circledIndex + 1, markerLength: leading + 1, style: "circled" };

  const half = toHalfWidth(trimmed);
  // (1) / 1. / 1) / 1、 / 1: / Q1 / Q1. / 質問1 など。数字の直後に区切りが必要(「10代」「1990年」等を見出しにしない)
  const match = half.match(/^(?:Q|q|質問)?\s*\(?([1-6])(?:\)|[.、,:：])\s*/);
  if (match) return { number: Number(match[1]), markerLength: leading + match[0].length, style: "digit" };

  // 「1 お名前」のように数字と項目名が空白だけで区切られている場合は、項目名が続くときのみ見出しとみなす
  // (「5 年付き合っている」のような回答の文章を見出しにしない)
  const spaced = half.match(/^(?:Q|q|質問)?\s*([1-6])\s+/);
  if (spaced) {
    const field = HEARING_FIELDS[Number(spaced[1]) - 1];
    const rest = half.slice(spaced[0].length);
    if (LABEL_KEYWORDS[field].some((keyword) => rest.startsWith(keyword))) {
      return { number: Number(spaced[1]), markerLength: leading + spaced[0].length, style: "digit" };
    }
  }
  return null;
}

function toIsoDate(year: number, month: number, day: number): string {
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return "";
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const ERA_START: Record<string, number> = { 昭和: 1925, 平成: 1988, 令和: 2018 };

// 生年月日として読める文字列を "YYYY-MM-DD" にする。読めなければ空文字(推測で補わない)
export function normalizeDateString(input: string): string {
  const text = toHalfWidth(input.trim());

  let match = text.match(/(昭和|平成|令和)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (match) {
    const eraYear = match[2] === "元" ? 1 : Number(match[2]);
    return toIsoDate(ERA_START[match[1]] + eraYear, Number(match[3]), Number(match[4]));
  }

  match = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (match) return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (match) return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  // 区切りの無い8桁(19900503)。前後に別の数字が続く場合は対象外
  match = text.match(/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/);
  if (match) return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  return "";
}

interface ChatLine {
  // 送信者(LINEのトーク履歴の形式でない行は null)
  sender: string | null;
  text: string;
}

// LINEのトーク履歴をコピーした文章を、送信者つきの行に分ける。
// 日付の見出し行は取り除き、「時刻<TAB>送信者<TAB>本文」の本文だけを残す。
// 複数行のメッセージ("…"で囲まれる)の2行目以降は、同じ送信者の行として扱う。
function splitLineChat(raw: string): { lines: ChatLine[]; isChat: boolean } {
  const lines: ChatLine[] = [];
  let sender: string | null = null;
  let inQuote = false;
  let isChat = false;
  for (const line of raw.split(/\r\n|\r|\n/)) {
    if (/^\s*\d{4}[/.]\d{1,2}[/.]\d{1,2}\s*[（(][^）)]{1,3}[）)]\s*$/.test(line)) continue;
    const chatLine = line.match(/^\s*\d{1,2}:\d{2}\t([^\t]*)\t(.*)$/);
    if (chatLine) {
      isChat = true;
      sender = chatLine[1];
      let text = chatLine[2];
      inQuote = text.startsWith('"') && !(text.length > 1 && text.endsWith('"'));
      text = text.replace(/^"/, "").replace(/"$/, "");
      lines.push({ sender, text });
      continue;
    }
    let text = line;
    if (inQuote && text.endsWith('"')) {
      text = text.slice(0, -1);
      inQuote = false;
    }
    lines.push({ sender, text });
  }
  return { lines, isChat };
}

// LINEのトーク履歴をコピーした文章から、日付の見出し行と「時刻<TAB>送信者<TAB>」の部分を取り除く
export function stripLineChatFormatting(raw: string): string {
  return splitLineChat(raw).lines.map((line) => line.text).join("\n");
}

interface Section {
  field: HearingField;
  lineIndex: number;
  // 見出し行の、見出しより後ろの部分(同じ行に回答が書かれている場合)
  inline: string;
}

// 回答のまとまり(見出しの並びと、そのまとまりが終わる行)
interface SectionRound {
  sections: Section[];
  endLine: number;
}

// 番号付きの見出しを探す。番号が1→6の順に増えるものだけを採用し、
// 同じ書式の「1」が再び現れたら新しいまとまりを始める(質問のテンプレートと回答を分けるため)
function findNumberedRounds(lines: string[]): SectionRound[] {
  const rounds: (SectionRound & { style: MarkerStyle; lastNumber: number })[] = [];
  lines.forEach((line, lineIndex) => {
    const marker = matchMarker(line);
    if (!marker) return;
    const current = rounds.at(-1);
    const field = HEARING_FIELDS[marker.number - 1];
    const section = { field, lineIndex, inline: stripLabelKeyword(field, line.slice(marker.markerLength).trim()) };
    if (current && marker.number > current.lastNumber) {
      current.sections.push(section);
      current.lastNumber = marker.number;
    } else if (!current || (marker.number === 1 && marker.style === current.style)) {
      if (current) current.endLine = lineIndex;
      rounds.push({ sections: [section], endLine: lines.length, style: marker.style, lastNumber: marker.number });
    }
  });
  return rounds;
}

// 番号の無い「項目名：回答」の行を探す(各項目1回まで)
function findLabelSections(lines: string[]): Section[] {
  const sections: Section[] = [];
  const used = new Set<HearingField>();
  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    for (const field of LABEL_LINE_ORDER) {
      if (used.has(field)) continue;
      const keyword = LABEL_LINE_KEYWORDS[field].find((k) => trimmed.startsWith(k));
      if (!keyword) continue;
      const rest = trimmed.slice(keyword.length).replace(/^\s*[（(][^）)]{0,10}[）)]/, "");
      // 項目名の直後にコロン(または行末)がある場合のみ見出しとみなす(「名前は〜」等の文章は対象外)
      if (!/^\s*([:：]|$)/.test(rest)) continue;
      sections.push({ field, lineIndex, inline: rest.replace(/^\s*[:：]\s*/, "").trim() });
      used.add(field);
      return;
    }
  });
  return sections;
}

function extractSections(lines: string[], sections: Section[], endLine: number): ParseHearingResult {
  const parsed: ParsedHearing = {
    name: "",
    birthDate: "",
    partnerName: "",
    partnerBirthDate: "",
    content: "",
    idealFuture: "",
  };
  const matchedFields: HearingField[] = [];
  const unparsedDateFields: HearingField[] = [];
  const explicitlyEmptyFields: HearingField[] = [];

  sections.forEach((section, i) => {
    const nextLineIndex = sections[i + 1]?.lineIndex ?? endLine;
    const restText = lines
      .slice(section.lineIndex + 1, nextLineIndex)
      .join("\n")
      .trim();
    // 見出しと同じ行の文章は、質問文(「〜ですか？」「〜教えてください」等)なら回答に含めない。
    // 回答の書き出しなら、次の行以降の続きとつなげる(「⑤彼からの連絡が…」の次の行に続きがある場合など)
    const inline = isQuestionText(section.inline) ? "" : section.inline;
    const value = [inline, restText].filter(Boolean).join("\n");
    if (!value) return;

    if (OPTIONAL_HEARING_FIELDS.has(section.field) && EMPTY_ANSWER_PATTERN.test(value)) {
      explicitlyEmptyFields.push(section.field);
      return;
    }

    if (DATE_FIELDS.has(section.field)) {
      const normalized = normalizeDateString(value);
      if (normalized) {
        parsed[section.field] = normalized;
        matchedFields.push(section.field);
      } else {
        unparsedDateFields.push(section.field);
      }
      return;
    }

    parsed[section.field] = value;
    matchedFields.push(section.field);
  });

  return { parsed, matchedFields, unparsedDateFields, explicitlyEmptyFields };
}

// 見出しの行に残った文章が、回答ではなく質問文かどうか
function isQuestionText(text: string): boolean {
  return /[？?]\s*$/.test(text) || /(ください|教えて|お聞かせ|お書き|ご記入)/.test(text);
}

function answeredCount(result: ParseHearingResult): number {
  return result.matchedFields.length + result.unparsedDateFields.length + result.explicitlyEmptyFields.length;
}

function parseLines(lines: string[]): ParseHearingResult {
  const rounds = findNumberedRounds(lines);
  if (rounds.length === 0) return extractSections(lines, findLabelSections(lines), lines.length);

  // 回答が最も多く読み取れたまとまりを採用する(同数なら後のもの)
  let best = extractSections(lines, rounds[0].sections, rounds[0].endLine);
  for (const round of rounds.slice(1)) {
    const result = extractSections(lines, round.sections, round.endLine);
    if (answeredCount(result) >= answeredCount(best)) best = result;
  }
  return best;
}

export function parseHearingText(raw: string): ParseHearingResult {
  const { lines, isChat } = splitLineChat(raw);
  const all = parseLines(lines.map((line) => line.text));
  if (!isChat) return all;

  // トーク履歴の形式なら、送信者ごとにも解析し、回答が最も多く読み取れた結果を採用する
  // (お客様の回答の間に挟まった鯛子の返信や、鯛子が送った質問文が回答に混ざらないようにする。同数なら送信者ごと)
  let best = all;
  const senders = [...new Set(lines.map((line) => line.sender).filter((sender): sender is string => sender !== null))];
  for (const sender of senders) {
    const result = parseLines(lines.filter((line) => line.sender === sender).map((line) => line.text));
    if (answeredCount(result) >= answeredCount(best)) best = result;
  }
  return best;
}

// 複数のメッセージに分かれた回答を、送信順につなげてから解析する
export function parseHearingMessages(messages: string[]): ParseHearingResult {
  return parseHearingText(messages.join("\n"));
}

// ---------- 取り込み内容の確認(既存の入力を勝手に上書きしない) ----------

export type HearingApplyAction =
  // 現在は空欄: 取り込んだ値を入れる(初期値でチェックあり)
  | "fill"
  // 現在の値と同じ: 何もしない
  | "same"
  // 現在の値と違う: 上書きするかを選ぶ(初期値でチェックなし)
  | "conflict";

export interface HearingApplyEntry {
  field: HearingField;
  current: string;
  next: string;
  action: HearingApplyAction;
}

// 読み取れた項目ごとに、今の入力内容と比べた取り込み方を返す(読み取れなかった項目は含めない)
export function planHearingApply(
  current: Pick<ParsedHearing, HearingField>,
  result: ParseHearingResult,
): HearingApplyEntry[] {
  return result.matchedFields.map((field) => {
    const now = (current[field] ?? "").trim();
    const next = result.parsed[field];
    const action: HearingApplyAction = now === "" ? "fill" : now === next.trim() ? "same" : "conflict";
    return { field, current: now, next, action };
  });
}

// 選んだ項目だけを反映した値を返す(選ばなかった項目・読み取れなかった項目は今の値のまま)
export function applySelectedHearingFields(
  entries: HearingApplyEntry[],
  selected: ReadonlySet<HearingField>,
): Partial<ParsedHearing> {
  const values: Partial<ParsedHearing> = {};
  for (const entry of entries) {
    if (entry.action !== "same" && selected.has(entry.field)) values[entry.field] = entry.next;
  }
  return values;
}
