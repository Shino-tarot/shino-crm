import { ContactMethod, HearingFormValues } from "@/types/freeReadingRequest";
import {
  NormalizedFreeReadingRequest,
  NormalizedHearing,
} from "@/lib/freeReadingRequests/validation";

export function normalizedRequestToInsertRow(data: NormalizedFreeReadingRequest) {
  return {
    reading_name: data.name,
    birth_date: data.birthDate,
    gender: data.gender,
    partner_name: data.partnerName,
    partner_birth_date: data.partnerBirthDate,
    partner_gender: data.partnerGender,
    content: data.content,
    ideal_future: data.idealFuture,
    contact_method: data.contactMethod,
    // line_nameは既存DB設計(not null default '')に合わせて空文字で保存する
    line_name: data.lineName ?? "",
    // instagram_usernameはnullable列のため、未使用時はNULLのまま保存する
    instagram_username: data.instagramUsername,
  };
}

export interface FreeReadingRequestRow {
  id: string;
  status: string;
  reading_name: string;
  age: number | null;
  birth_date: string | null;
  gender: string | null;
  partner_name: string | null;
  partner_birth_date: string | null;
  partner_gender: string | null;
  content: string;
  ideal_future: string | null;
  contact_method: string;
  line_name: string;
  instagram_username: string | null;
  memo: string;
  created_at: string;
}

export interface FreeReadingRequestListItem {
  id: string;
  status: string;
  name: string;
  age: number | null;
  birthDate: string | null;
  gender: string | null;
  partnerName: string | null;
  partnerBirthDate: string | null;
  partnerGender: string | null;
  content: string;
  idealFuture: string | null;
  contactMethod: ContactMethod;
  lineName: string;
  instagramUsername: string | null;
  memo: string;
  createdAt: string;
}

export function rowToRequestListItem(
  row: FreeReadingRequestRow,
): FreeReadingRequestListItem {
  return {
    id: row.id,
    status: row.status,
    name: row.reading_name,
    age: row.age,
    birthDate: row.birth_date,
    gender: row.gender,
    partnerName: row.partner_name,
    partnerBirthDate: row.partner_birth_date,
    partnerGender: row.partner_gender,
    content: row.content,
    idealFuture: row.ideal_future,
    contactMethod: row.contact_method as ContactMethod,
    lineName: row.line_name,
    instagramUsername: row.instagram_username,
    // memo列は0005マイグレーション未適用のDBだとundefinedになりうるため、
    // 適用前でも操作フォームが壊れないようフォールバックしておく
    memo: row.memo ?? "",
    createdAt: row.created_at,
  };
}

// LINEヒアリングの手動登録・編集(管理画面専用のCRM機能)用の変換関数。
// 公開フォーム由来の項目(gender/partnerGender/contactMethod/instagramUsername)は
// 手動登録では使わないため、gender/partner_genderは空・NULLで、
// contact_methodはLINEヒアリング由来であることを示す固定値"line"で保存する。
export function hearingToInsertRow(data: NormalizedHearing) {
  return {
    reading_name: data.name,
    line_name: data.lineName,
    birth_date: data.birthDate,
    partner_name: data.partnerName,
    partner_birth_date: data.partnerBirthDate,
    content: data.content,
    ideal_future: data.idealFuture,
    memo: data.memo,
    status: data.status,
    contact_method: "line",
    gender: "",
    partner_gender: null,
    instagram_username: null,
  };
}

export function hearingToUpdateRow(data: NormalizedHearing) {
  return {
    reading_name: data.name,
    line_name: data.lineName,
    birth_date: data.birthDate,
    partner_name: data.partnerName,
    partner_birth_date: data.partnerBirthDate,
    content: data.content,
    ideal_future: data.idealFuture,
    memo: data.memo,
    status: data.status,
  };
}

export function rowToHearingFormValues(
  row: FreeReadingRequestRow,
): HearingFormValues {
  return {
    lineName: row.line_name,
    name: row.reading_name,
    birthDate: row.birth_date ?? "",
    partnerName: row.partner_name ?? "",
    partnerBirthDate: row.partner_birth_date ?? "",
    content: row.content,
    idealFuture: row.ideal_future ?? "",
    memo: row.memo ?? "",
    status: row.status,
  };
}
