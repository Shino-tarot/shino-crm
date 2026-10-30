export type ConversationDirection = "incoming" | "outgoing";

// line_webhook=LINEから自動保存(編集・削除不可) / manual=スタッフが手動登録(編集・論理削除可)
export type ConversationSource = "line_webhook" | "manual";

export interface ConversationMessage {
  id: string;
  direction: ConversationDirection;
  source: ConversationSource;
  messageType: string;
  body: string;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageFormValues {
  direction: ConversationDirection | "";
  // input type="datetime-local"の値(日本時間 "YYYY-MM-DDTHH:mm")
  sentAt: string;
  body: string;
}

export const EMPTY_CONVERSATION_MESSAGE_FORM_VALUES: ConversationMessageFormValues = {
  direction: "",
  sentAt: "",
  body: "",
};
