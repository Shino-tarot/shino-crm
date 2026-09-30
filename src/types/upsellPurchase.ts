export interface UpsellPurchase {
  id: string;
  customerId: string;
  purchaseDate: string;
  productName: string;
  productType: string;
  amount: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsellPurchaseFormValues {
  purchaseDate: string;
  productName: string;
  productType: string;
  amount: number | null;
  memo: string;
}

export const EMPTY_UPSELL_PURCHASE_FORM_VALUES: UpsellPurchaseFormValues = {
  purchaseDate: "",
  productName: "",
  productType: "",
  amount: null,
  memo: "",
};
