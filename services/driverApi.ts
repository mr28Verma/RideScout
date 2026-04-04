import { getApiBaseUrl } from "@/constants/api";

export interface PendingRide {
  rideId: string;
  passengerId: string;
  passengerName: string;
  passengerRating: number;
  pickup: string;
  drop: string;
  estimatedFare: number;
  distance: string;
  eta: string;
  createdAt: string;
}

export interface DriverEarnings {
  driverId: string;
  todayEarnings: number;
  todayTrips: number;
  totalEarnings: number;
  totalTrips: number;
  rating: number;
  acceptanceRate: number;
}

export interface DriverRideRecord {
  rideId: string;
  passengerName: string;
  passengerRating: number;
  pickup: string;
  drop: string;
  fare: number;
  status: string;
  date: string;
  distance: string;
}

export interface ActiveTrip {
  rideId: string;
  status: string;
  passengerName: string;
  passengerPhone: string;
  passengerRating: number;
  pickup: string;
  drop: string;
  estimatedFare: number;
}

// Toggle driver online/offline
export const toggleOnlineStatus = async (
  driverId: string,
  isOnline: boolean,
  lat?: number,
  lng?: number,
) => {
  const response = await fetch(`${getApiBaseUrl()}/api/driver/toggle-online`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driverId, isOnline, lat, lng }),
  });

  if (!response.ok) {
    throw new Error("Failed to toggle driver status");
  }

  return response.json();
};

// Update driver location
export const updateDriverLocation = async (
  driverId: string,
  lat: number,
  lng: number,
  locationName?: string,
) => {
  const response = await fetch(`${getApiBaseUrl()}/api/driver/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driverId, lat, lng, locationName }),
  });

  if (!response.ok) {
    throw new Error("Failed to update driver location");
  }

  return response.json();
};

// Get pending ride requests
export const getPendingRides = async (
  driverId: string,
): Promise<PendingRide[]> => {
  const response = await fetch(
    `${getApiBaseUrl()}/api/driver/pending-rides/${driverId}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch pending rides");
  }

  const data = await response.json();
  return data.rides;
};

// Accept a ride
export const acceptRide = async (rideId: string, driverId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/driver/accept-ride`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rideId, driverId }),
  });

  if (!response.ok) {
    throw new Error("Failed to accept ride");
  }

  return response.json();
};

// Reject a ride
export const rejectRide = async (rideId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/driver/reject-ride`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rideId }),
  });

  if (!response.ok) {
    throw new Error("Failed to reject ride");
  }

  return response.json();
};

// Get driver earnings
export const getDriverEarnings = async (
  driverId: string,
): Promise<DriverEarnings> => {
  const response = await fetch(
    `${getApiBaseUrl()}/api/driver/earnings/${driverId}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch earnings");
  }

  return response.json();
};

// Get driver ride history
export const getDriverRideHistory = async (
  driverId: string,
): Promise<DriverRideRecord[]> => {
  const response = await fetch(
    `${getApiBaseUrl()}/api/driver/ride-history/${driverId}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch ride history");
  }

  const data = await response.json();
  return data.rides;
};

// Get active trips (for navigation)
export const getActiveTrips = async (
  driverId: string,
): Promise<ActiveTrip[]> => {
  const response = await fetch(
    `${getApiBaseUrl()}/api/driver/active-trips/${driverId}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch active trips");
  }

  const data = await response.json();
  return data.trips;
};

// Update ride status (driver marking pickup/dropoff)
export const updateRideStatus = async (rideId: string, status: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/driver/update-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rideId, status }),
  });

  if (!response.ok) {
    throw new Error("Failed to update ride status");
  }

  return response.json();
};
