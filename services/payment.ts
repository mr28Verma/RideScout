export type PaymentProvider = "mock" | "stripe" | "razorpay";

export type PaymentPayload = {
  amount: number;
  currency: "INR";
  rideId: string;
};

export async function processPayment(
  provider: PaymentProvider,
  payload: PaymentPayload,
) {
  switch (provider) {
    case "stripe":
      return stripeReadyPayment(payload);
    case "razorpay":
      return razorpayReadyPayment(payload);
    case "mock":
    default:
      return mockPayment(payload);
  }
}

async function mockPayment(payload: PaymentPayload) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    success: true,
    provider: "mock",
    transactionId: `MOCK-${Date.now()}`,
    amount: payload.amount,
  };
}

// Ready structure for Stripe integration
async function stripeReadyPayment(payload: PaymentPayload) {
  return {
    success: true,
    provider: "stripe",
    status: "integration_pending",
    amount: payload.amount,
  };
}

// Ready structure for Razorpay integration
async function razorpayReadyPayment(payload: PaymentPayload) {
  return {
    success: true,
    provider: "razorpay",
    status: "integration_pending",
    amount: payload.amount,
  };
}
