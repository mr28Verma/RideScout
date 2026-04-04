import { getApiBaseUrl } from "@/constants/api";

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: "passenger" | "driver";
  // Driver-specific fields
  isOnline?: boolean;
  vehicle?: string;
  vehicleNumber?: string;
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
  const url = `${getApiBaseUrl()}/api/auth/profile/${userId}`;
  console.log(`[Profile API] Fetching profile from: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
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
  const response = await fetch(
    `${getApiBaseUrl()}/api/auth/profile/${userId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
  const response = await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to logout");
  }
};
