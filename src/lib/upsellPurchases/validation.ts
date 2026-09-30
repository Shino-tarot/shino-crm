import { UpsellPurchaseFormValues } from "@/types/upsellPurchase";
import { NormalizedUpsellPurchase } from "@/lib/upsellPurchases/mapper";

export const PRODUCT_NAME_MAX_LENGTH = 100;
export const PRODUCT_TYPE_MAX_LENGTH = 50;
export const MEMO_MAX_LENGTH = 2000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type UpsellPurchaseValidationResult =
  | { valid: true; data: NormalizedUpsellPurchase }
  | { valid: false; errors: Record<string, string> };

export function validateUpsellPurchaseForm(
  values: UpsellPurchaseFormValues,
): UpsellPurchaseValidationResult {
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

  const productType = values.productType.trim();
  if (productType.length > PRODUCT_TYPE_MAX_LENGTH) {
    errors.productType = `商品種別は${PRODUCT_TYPE_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (values.amount === null || Number.isNaN(values.amount)) {
    errors.amount = "購入金額を入力してください。";
  } else if (!Number.isInteger(values.amount) || values.amount < 0) {
    errors.amount = "購入金額は0以上の整数で入力してください。";
  }

  const memo = values.memo.trim();
  if (memo.length > MEMO_MAX_LENGTH) {
    errors.memo = `メモは${MEMO_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      purchaseDate,
      productName,
      productType: productType || null,
      amount: values.amount as number,
      memo,
    },
  };
}
