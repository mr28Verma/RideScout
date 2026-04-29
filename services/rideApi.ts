import { API_GET_HEADERS, API_JSON_HEADERS, getApiBaseUrl } from "@/constants/api";

export type FareEstimate = {
  estimatedFare: number;
  distanceKm: number;
  estimatedDurationMinutes?: number;
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

export type RideStatus =
  | "bidding"
  | "searching"
  | "accepted"
  | "arriving"
  | "on_trip"
  | "completed";
export type MarketplaceRideStatus =
  | "bidding"
  | "searching"
  | "accepted"
  | "arriving"
  | "on_trip"
  | "completed";

export type RideBid = {
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicle: string;
  rating: number;
  amount: number;
  etaMinutes: number;
  note: string;
  status: "pending" | "selected" | "declined";
  createdAt: string;
};

export type RideMessage = {
  senderType: "passenger" | "driver";
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
};

export type RideMarketplace = {
  rideId: string;
  passengerId: string;
  pickup: string;
  drop: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  estimatedFare: number;
  actualFare?: number | null;
  requestedRideType: string;
  paymentMethod: "mock" | "stripe" | "razorpay";
  status: MarketplaceRideStatus;
  routeMetrics?: {
    distanceKm?: number | null;
    estimatedDurationMinutes?: number | null;
    routeDemandScore?: number;
  };
  assignedDriver?: {
    id: string;
    name: string;
    phone?: string;
    vehicle: string;
    vehicleNumber?: string;
    rating: number;
    lat?: number;
    lng?: number;
  } | null;
  passengerRating?: {
    score?: number | null;
    feedback?: string;
    submittedAt?: string | null;
  } | null;
  bids: RideBid[];
  messages: RideMessage[];
  createdAt: string;
  updatedAt: string;
};

export type RouteMarketIntel = {
  similarPassengers: number;
  routeDemandScore: number;
  openRequests: Array<{
    rideId: string;
    pickup: string;
    drop: string;
    estimatedFare: number;
    requestedRideType: string;
    bidCount: number;
    status: string;
    createdAt: string;
  }>;
};

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

export async function fetchRouteMarketIntel(payload: {
  pickup: string;
  drop: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  passengerId?: string;
}): Promise<RouteMarketIntel> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/route-market-intel`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  const data = await readJson<RouteMarketIntel & { message?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch route market intel");
  }

  return data;
}

export async function createMarketplaceRideRequest(payload: {
  passengerId: string;
  pickup: string;
  drop: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  estimatedFare: number;
  paymentMethod?: "mock" | "stripe" | "razorpay";
  requestedRideType?: string;
  distanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
}): Promise<{ ride: RideMarketplace }> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/marketplace-request`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  const data = await readJson<{ ride: RideMarketplace; message?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to open request for bids");
  }

  return data;
}

export async function fetchRideMarketplace(
  rideId: string,
): Promise<RideMarketplace> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/marketplace/${rideId}`, {
    headers: API_GET_HEADERS,
  });

  const data = await readJson<{ ride: RideMarketplace; message?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch ride marketplace");
  }

  return data.ride;
}

export async function fetchActiveRide(
  passengerId: string,
): Promise<RideMarketplace | null> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/active/${passengerId}`, {
    headers: API_GET_HEADERS,
  });

  const data = await readJson<{ ride: RideMarketplace | null; message?: string }>(
    response,
  );
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch active ride");
  }

  return data.ride ?? null;
}

export async function selectDriverBid(
  rideId: string,
  driverId: string,
): Promise<{ ride: RideMarketplace }> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/marketplace/select-bid`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify({ rideId, driverId }),
  });

  const data = await readJson<{ ride: RideMarketplace; message?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to select driver bid");
  }

  return data;
}

export async function sendRideMessage(payload: {
  rideId: string;
  senderType: "passenger" | "driver";
  senderId: string;
  text: string;
}): Promise<{ chatMessage: RideMessage }> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/marketplace/message`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  const data = await readJson<{ chatMessage: RideMessage; message?: string }>(
    response,
  );
  if (!response.ok) {
    throw new Error(data.message || "Failed to send message");
  }

  return data;
}

export async function bookRide(payload: {
  passengerId: string;
  pickup: string;
  drop: string;
  estimatedFare: number;
  paymentMethod?: "mock" | "stripe" | "razorpay";
  requestedRideType?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
}): Promise<{ ride: RideMarketplace }> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/book`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  const data = await readJson<{
    ride: RideMarketplace;
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

export async function rateCompletedRide(payload: {
  rideId: string;
  passengerId: string;
  score: number;
  feedback?: string;
}): Promise<{ ride: RideMarketplace }> {
  const response = await fetch(`${getApiBaseUrl()}/api/rides/rate`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  const data = await readJson<{ ride: RideMarketplace; message?: string }>(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to rate ride");
  }

  return data;
}
