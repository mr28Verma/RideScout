export type PaymentProvider = "mock" | "stripe" | "razorpay";

export type PaymentPayload = {
  amount: number;
  currency: "INR";
  rideId: string;
};

import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { API_JSON_HEADERS } from "@/constants/api";
import { apiFetch } from "@/services/api";

type PaymentResult = {
  success: boolean;
  provider: PaymentProvider;
  transactionId?: string;
  amount: number;
  status?: string;
  reason?: string;
};

export async function processPayment(
  provider: PaymentProvider,
  payload: PaymentPayload,
): Promise<PaymentResult> {
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
    provider: "mock" as const,
    transactionId: `MOCK-${Date.now()}`,
    amount: payload.amount,
  };
}

// Ready structure for Stripe integration
async function stripeReadyPayment(payload: PaymentPayload) {
  return {
    success: true,
    provider: "stripe" as const,
    status: "integration_pending",
    amount: payload.amount,
  };
}

// Ready structure for Razorpay integration
async function razorpayReadyPayment(payload: PaymentPayload) {
  const orderResponse = await apiFetch("/api/payments/orders", {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  const orderData = await orderResponse.json();
  if (!orderResponse.ok || !orderData.checkoutUrl) {
    throw new Error(orderData.message || "Could not create Razorpay order");
  }

  const redirectUri = Linking.createURL("payment-callback");
  const result = await WebBrowser.openAuthSessionAsync(
    orderData.checkoutUrl,
    redirectUri,
  );

  if (result.type !== "success" || !result.url) {
    await recordPaymentFailure(payload.rideId, "Payment cancelled");
    return {
      success: false,
      provider: "razorpay" as const,
      amount: payload.amount,
      status: "cancelled",
      reason: "Payment cancelled",
    };
  }

  const parsed = Linking.parse(result.url);
  const status = getQueryParam(parsed.queryParams?.status);
  const paymentId = getQueryParam(parsed.queryParams?.paymentId);
  const reason = getQueryParam(parsed.queryParams?.reason);

  if (status === "success") {
    return {
      success: true,
      provider: "razorpay" as const,
      transactionId: paymentId || orderData.orderId,
      amount: payload.amount,
      status: "paid",
    };
  }

  await recordPaymentFailure(payload.rideId, reason || "Payment failed");
  return {
    success: false,
    provider: "razorpay" as const,
    amount: payload.amount,
    status: "failed",
    reason: reason || "Payment failed",
  };
}

function getQueryParam(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function recordPaymentFailure(rideId: string, reason: string) {
  try {
    await apiFetch("/api/payments/failure", {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ rideId, reason }),
    });
  } catch {
    // The UI already knows the payment failed; backend logging is best-effort.
  }
}
