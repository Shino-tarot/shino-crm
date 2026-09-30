import { PaidReadingFormValues } from "@/types/paidReading";
import { fromJstDateTimeLocal } from "@/lib/format";
import { NormalizedPaidReading } from "@/lib/paidReadings/mapper";

export const PRODUCT_NAME_MAX_LENGTH = 100;
export const PAYMENT_METHOD_MAX_LENGTH = 50;
export const LONG_TEXT_MAX_LENGTH = 20000;
export const MEMO_MAX_LENGTH = 2000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export type PaidReadingValidationResult =
  | { valid: true; data: NormalizedPaidReading }
  | { valid: false; errors: Record<string, string> };

export function validatePaidReadingForm(
  values: PaidReadingFormValues,
): PaidReadingValidationResult {
  const errors: Record<string, string> = {};

  const purchaseDate = values.purchaseDate.trim();
  if (!purchaseDate) {
    errors.purchaseDate = "購入日を入力してください。";
  } else if (!DATE_PATTERN.test(purchaseDate)) {
    errors.purchaseDate = "購入日の形式が正しくありません。";
  }

  const productName = values.productName.trim();
  if (!productName) {
    errors.productName = "商品名を入力してください。";
  } else if (productName.length > PRODUCT_NAME_MAX_LENGTH) {
    errors.productName = `商品名は${PRODUCT_NAME_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (values.amount === null || Number.isNaN(values.amount)) {
    errors.amount = "購入金額を入力してください。";
  } else if (!Number.isInteger(values.amount) || values.amount < 0) {
    errors.amount = "購入金額は0以上の整数で入力してください。";
  }

  const paymentMethod = values.paymentMethod.trim();
  if (paymentMethod.length > PAYMENT_METHOD_MAX_LENGTH) {
    errors.paymentMethod = `購入経路・決済方法は${PAYMENT_METHOD_MAX_LENGTH}文字以内で入力してください。`;
  }

  const hearingContent = values.hearingContent.trim();
  if (hearingContent.length > LONG_TEXT_MAX_LENGTH) {
    errors.hearingContent = `ヒアリング内容は${LONG_TEXT_MAX_LENGTH}文字以内で入力してください。`;
  }

  const readingContent = values.readingContent.trim();
  if (readingContent.length > LONG_TEXT_MAX_LENGTH) {
    errors.readingContent = `鑑定文は${LONG_TEXT_MAX_LENGTH}文字以内で入力してください。`;
  }

  const memo = values.memo.trim();
  if (memo.length > MEMO_MAX_LENGTH) {
    errors.memo = `メモは${MEMO_MAX_LENGTH}文字以内で入力してください。`;
  }

  const sentAtInput = values.sentAt.trim();
  if (sentAtInput && !DATETIME_LOCAL_PATTERN.test(sentAtInput)) {
    errors.sentAt = "送付日時の形式が正しくありません。";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      purchaseDate,
      productName,
      amount: values.amount as number,
      paymentMethod: paymentMethod || null,
      hearingContent: hearingContent || null,
      readingContent: readingContent || null,
      sentAt: sentAtInput ? fromJstDateTimeLocal(sentAtInput) : null,
      memo,
    },
  };
}
