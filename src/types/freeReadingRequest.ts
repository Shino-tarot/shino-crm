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
