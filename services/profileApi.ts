import { API_JSON_HEADERS } from "@/constants/api";
import { apiFetch } from "@/services/api";

export type RidePreference = "bike" | "mini" | "sedan" | "suv";

export type SavedPlace = {
  id: string;
  label: string;
  address: string;
  lat?: number;
  lng?: number;
};

export type PaymentMethodType = "mock" | "stripe" | "razorpay";

export type PaymentMethod = {
  id: string;
  label: string;
  type: PaymentMethodType;
  last4: string;
  isDefault: boolean;
};

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "passenger" | "driver";
  preferredRideType?: RidePreference;
  savedPlaces?: SavedPlace[];
  paymentMethods?: PaymentMethod[];
  emergencyContacts?: EmergencyContact[];
  // Driver-specific fields
  isOnline?: boolean;
  vehicle?: string;
  vehicleNumber?: string;
  currentLocation?: string | null;
  rating?: number;
  totalEarnings?: number;
  totalRides?: number;
  acceptanceRate?: number;
  lat?: number;
  lng?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Fetch user profile
export const fetchUserProfile = async (
  userId: string,
): Promise<UserProfile> => {
  const url = `/api/auth/profile/${userId}`;
  console.log(`[Profile API] Fetching profile from: ${url}`);

  const response = await apiFetch(url, {
    method: "GET",
    headers: API_JSON_HEADERS,
  });

  console.log(`[Profile API] Response status: ${response.status}`);

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    let error;
    try {
      if (contentType && contentType.includes("application/json")) {
        error = await response.json();
      } else {
        const text = await response.text();
        console.error(`[Profile API] Non-JSON response:`, text);
        throw new Error(
          `Server returned ${response.status}: ${text.substring(0, 100)}`,
        );
      }
    } catch (parseError) {
      console.error(
        `[Profile API] Failed to parse error response:`,
        parseError,
      );
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    throw new Error(error.message || "Failed to fetch profile");
  }

  return response.json();
};

// Update user profile
export const updateUserProfile = async (
  userId: string,
  updates: Partial<UserProfile>,
): Promise<UserProfile> => {
  const response = await apiFetch(
    `/api/auth/profile/${userId}`,
    {
      method: "PATCH",
      headers: API_JSON_HEADERS,
      body: JSON.stringify(updates),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update profile");
  }

  return response.json();
};

// Logout (optional - can be handled on client side)
export const logout = async (userId: string): Promise<void> => {
  const response = await apiFetch("/api/auth/logout", {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to logout");
  }
};
