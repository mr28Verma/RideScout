import { API_GET_HEADERS, API_JSON_HEADERS, getApiBaseUrl } from "@/constants/api";

export type FareEstimate = {
  estimatedFare: number;
  distanceKm: number;
  currency: string;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surge: number;
};

export type DriverInfo = {
  id: string;
  name: string;
  vehicle: string;
  rating: number;
  lat: number;
  lng: number;
};

export type RideStatus = "searching" | "accepted" | "on_trip" | "completed";

export type RideRecord = {
  _id: string;
  pickup: string;
  drop: string;
  estimatedFare: number;
  paymentMethod: "mock" | "stripe" | "razorpay";
  status: RideStatus;
  createdAt: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : ({} as T);
  } catch {
    const preview = text.trim().slice(0, 160) || "Empty response";
    throw new Error(
      `Server returned non-JSON response (${response.status}): ${preview}`,
    );
  }
}

export async function estimateFare(
  pickup: string,
  drop: string,
  pickupLat?: number,
  pickupLng?: number,
  dropLat?: number,
  dropLng?: number,
): Promise<FareEstimate> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/estimate-fare`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify({
      pickup,
      drop,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
    }),
  });

  const data = await readJson<FareEstimate & { message?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to estimate fare");
  }

  return data;
}

export async function fetchNearbyDrivers(
  pickupLat?: number,
  pickupLng?: number,
): Promise<DriverInfo[]> {
  const params = new URLSearchParams();
  if (pickupLat !== undefined) params.append("pickupLat", String(pickupLat));
  if (pickupLng !== undefined) params.append("pickupLng", String(pickupLng));

  const url =
    `${getApiBaseUrl()}/api/rides/nearby-drivers` +
    (params.toString() ? `?${params.toString()}` : "");

  const response = await fetch(url, { headers: API_GET_HEADERS });
  const data = await readJson<{ drivers?: DriverInfo[]; message?: string }>(
    response,
  );
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch drivers");
  }
  return data.drivers || [];
}

export async function bookRide(payload: {
  passengerId: string;
  pickup: string;
  drop: string;
  estimatedFare: number;
  paymentMethod?: "mock" | "stripe" | "razorpay";
}): Promise<{ ride: { _id: string; status: RideStatus } }> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/book`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  const data = await readJson<{
    ride: { _id: string; status: RideStatus };
    message?: string;
  }>(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to book ride");
  }

  return data;
}

export async function fetchRideHistory(
  passengerId: string,
): Promise<RideRecord[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/rides/history/${passengerId}`,
    { headers: API_GET_HEADERS },
  );
  const data = await readJson<{ rides?: RideRecord[]; message?: string }>(
    response,
  );
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch history");
  }

  return data.rides || [];
}
