export const CONTACT_METHODS = ["line", "instagram"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

// 診断Webアプリで選択される診断テーマの内部値。
// DB(diagnosis_theme)には日本語ではなくこの内部値を保存する。
// 将来テーマが増える場合はこの配列に追加するだけでよい(DB側にCHECK制約はない)。
export const DIAGNOSIS_THEMES = [
  { value: "money", label: "お金" },
  { value: "love", label: "恋愛" },
  { value: "work", label: "仕事" },
  { value: "relationships", label: "人間関係" },
  { value: "other", label: "その他" },
] as const;
export type DiagnosisTheme = (typeof DIAGNOSIS_THEMES)[number]["value"];
export const DIAGNOSIS_THEME_VALUES = DIAGNOSIS_THEMES.map(
  (theme) => theme.value,
) as readonly string[];

// DBのCHECK制約(free_reading_requests.gender)に合わせた値
export const GENDER_OPTIONS = [
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
  { value: "other", label: "その他" },
  { value: "prefer_not_to_say", label: "回答しない" },
] as const;

// DBのCHECK制約(free_reading_requests.partner_gender)に合わせた値
// お相手本人ではなく回答者から見た「わからない」を許容するためunknownを含む
export const PARTNER_GENDER_OPTIONS = [
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
  { value: "other", label: "その他" },
  { value: "unknown", label: "わからない" },
] as const;

export interface FreeReadingFormValues {
  name: string;
  birthDate: string;
  gender: string;
  partnerName: string;
  partnerBirthDate: string;
  partnerGender: string;
  content: string;
  idealFuture: string;
  contactMethod: ContactMethod | "";
  lineName: string;
  instagramUsername: string;
}

export const EMPTY_FREE_READING_FORM_VALUES: FreeReadingFormValues = {
  name: "",
  birthDate: "",
  gender: "",
  partnerName: "",
  partnerBirthDate: "",
  partnerGender: "",
  content: "",
  idealFuture: "",
  contactMethod: "",
  lineName: "",
  instagramUsername: "",
};

// LINEで届いた無料鑑定ヒアリングをCRM側で管理するための入力値
// (公開フォーム由来のFreeReadingFormValuesとは異なり、性別・鑑定方法の選択は不要)
export interface HearingFormValues {
  lineName: string;
  name: string;
  birthDate: string;
  partnerName: string;
  partnerBirthDate: string;
  content: string;
  idealFuture: string;
  memo: string;
  status: string;
  // お客様が実際に無料鑑定へ申し込んだ日。created_at(CRM登録日時)とは役割が異なり、
  // 未入力(空文字)も許可する
  applicationDate: string;
  // 診断Webアプリが発行する鑑定コード(4〜6桁の数字文字列)。未入力も許可する
  diagnosisCode: string;
  // 診断テーマの内部値(DIAGNOSIS_THEMESのいずれか)。未入力も許可する
  diagnosisTheme: string;
  // 診断Webアプリが表示した診断結果タイプの名称。未確定な自由文字列
  diagnosisResultType: string;
  // Web診断を完了した日時。datetime-local形式("YYYY-MM-DDTHH:mm")、未入力も許可する
  diagnosedAt: string;
}

export const EMPTY_HEARING_FORM_VALUES: HearingFormValues = {
  lineName: "",
  name: "",
  birthDate: "",
  partnerName: "",
  partnerBirthDate: "",
  content: "",
  idealFuture: "",
  memo: "",
  status: "new",
  applicationDate: "",
  diagnosisCode: "",
  diagnosisTheme: "",
  diagnosisResultType: "",
  diagnosedAt: "",
};
