export interface PaidReading {
  id: string;
  customerId: string;
  purchaseDate: string;
  productName: string;
  amount: number;
  paymentMethod: string;
  hearingContent: string;
  readingContent: string;
  sentAt: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaidReadingFormValues {
  purchaseDate: string;
  productName: string;
  amount: number | null;
  paymentMethod: string;
  hearingContent: string;
  readingContent: string;
  sentAt: string;
  memo: string;
}

export const EMPTY_PAID_READING_FORM_VALUES: PaidReadingFormValues = {
  purchaseDate: "",
  productName: "",
  amount: null,
  paymentMethod: "",
  hearingContent: "",
  readingContent: "",
  sentAt: "",
  memo: "",
};
