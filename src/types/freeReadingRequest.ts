export const CONTACT_METHODS = ["line", "instagram"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

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
};
