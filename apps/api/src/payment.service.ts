import type { PaymentMethod } from "@taxilao/shared";

export type PaymentIntentDraft = {
  bookingId: string;
  amountLak: number;
  method: PaymentMethod;
};

export function createPaymentIntentDraft(input: PaymentIntentDraft) {
  return {
    ...input,
    status: "PENDING",
    providerReference: null,
    metadata: {
      readyForProvider: ["CARD", "BANK_QR", "USDT_TRC20", "USDT_BEP20"].includes(input.method)
    }
  };
}
