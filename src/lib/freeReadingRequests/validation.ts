import {
  ContactMethod,
  FreeReadingFormValues,
  GENDER_OPTIONS,
  PARTNER_GENDER_OPTIONS,
} from "@/types/freeReadingRequest";

export const NAME_MAX_LENGTH = 50;
export const PARTNER_NAME_MAX_LENGTH = 50;
export const LINE_NAME_MAX_LENGTH = 50;
export const INSTAGRAM_USERNAME_MAX_LENGTH = 30;
export const CONTENT_MAX_LENGTH = 2000;
export const IDEAL_FUTURE_MAX_LENGTH = 2000;

const INSTAGRAM_USERNAME_PATTERN = /^[A-Za-z0-9._]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GENDER_VALUES = GENDER_OPTIONS.map((option) => option.value) as readonly string[];
const PARTNER_GENDER_VALUES = PARTNER_GENDER_OPTIONS.map(
  (option) => option.value,
) as readonly string[];

function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export interface NormalizedFreeReadingRequest {
  name: string;
  birthDate: string;
  gender: string;
  partnerName: string | null;
  partnerBirthDate: string | null;
  partnerGender: string | null;
  content: string;
  idealFuture: string;
  contactMethod: ContactMethod;
  lineName: string | null;
  instagramUsername: string | null;
}

export type ValidationResult =
  | { valid: true; data: NormalizedFreeReadingRequest }
  | { valid: false; errors: Record<string, string> };

export function validateFreeReadingForm(
  values: FreeReadingFormValues,
): ValidationResult {
  const errors: Record<string, string> = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "名前を入力してください。";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `名前は${NAME_MAX_LENGTH}文字以内で入力してください。`;
  }

  const birthDate = values.birthDate.trim();
  if (!birthDate) {
    errors.birthDate = "生年月日を入力してください。";
  } else if (!isValidDateString(birthDate)) {
    errors.birthDate = "生年月日の形式が正しくありません。";
  }

  const gender = values.gender.trim();
  if (!gender) {
    errors.gender = "性別を選択してください。";
  } else if (!GENDER_VALUES.includes(gender)) {
    errors.gender = "性別の選択内容が正しくありません。";
  }

  const partnerName = values.partnerName.trim();
  if (partnerName.length > PARTNER_NAME_MAX_LENGTH) {
    errors.partnerName = `お相手のお名前は${PARTNER_NAME_MAX_LENGTH}文字以内で入力してください。`;
  }

  const partnerBirthDate = values.partnerBirthDate.trim();
  if (partnerBirthDate !== "" && !isValidDateString(partnerBirthDate)) {
    errors.partnerBirthDate = "お相手の生年月日の形式が正しくありません。";
  }

  const partnerGender = values.partnerGender.trim();
  if (partnerGender !== "" && !PARTNER_GENDER_VALUES.includes(partnerGender)) {
    errors.partnerGender = "お相手の性別の選択内容が正しくありません。";
  }

  const content = values.content.trim();
  if (!content) {
    errors.content = "今悩んでいることを入力してください。";
  } else if (content.length > CONTENT_MAX_LENGTH) {
    errors.content = `今悩んでいることは${CONTENT_MAX_LENGTH}文字以内で入力してください。`;
  }

  const idealFuture = values.idealFuture.trim();
  if (!idealFuture) {
    errors.idealFuture = "どうなっていたら理想的かを入力してください。";
  } else if (idealFuture.length > IDEAL_FUTURE_MAX_LENGTH) {
    errors.idealFuture = `どうなっていたら理想的かは${IDEAL_FUTURE_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (values.contactMethod !== "line" && values.contactMethod !== "instagram") {
    errors.contactMethod = "鑑定方法を選択してください。";
  }

  let lineName: string | null = null;
  let instagramUsername: string | null = null;

  if (values.contactMethod === "line") {
    const trimmedLineName = values.lineName.trim();
    if (!trimmedLineName) {
      errors.lineName = "LINE表示名を入力してください。";
    } else if (trimmedLineName.length > LINE_NAME_MAX_LENGTH) {
      errors.lineName = `LINE表示名は${LINE_NAME_MAX_LENGTH}文字以内で入力してください。`;
    } else {
      lineName = trimmedLineName;
    }
  } else if (values.contactMethod === "instagram") {
    let trimmedUsername = values.instagramUsername.trim();
    if (trimmedUsername.startsWith("@")) {
      trimmedUsername = trimmedUsername.slice(1);
    }
    if (!trimmedUsername) {
      errors.instagramUsername = "Instagram IDを入力してください。";
    } else if (trimmedUsername.length > INSTAGRAM_USERNAME_MAX_LENGTH) {
      errors.instagramUsername = `Instagram IDは${INSTAGRAM_USERNAME_MAX_LENGTH}文字以内で入力してください。`;
    } else if (!INSTAGRAM_USERNAME_PATTERN.test(trimmedUsername)) {
      errors.instagramUsername =
        "Instagram IDは英数字・ピリオド・アンダースコアのみ使用できます。";
    } else {
      instagramUsername = trimmedUsername;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      name,
      birthDate,
      gender,
      partnerName: partnerName || null,
      partnerBirthDate: partnerBirthDate || null,
      partnerGender: partnerGender || null,
      content,
      idealFuture,
      contactMethod: values.contactMethod as ContactMethod,
      lineName,
      instagramUsername,
    },
  };
}
