import { Platform } from "react-native";

const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL;

// For web, always use localhost. For native, use IP detection
let baseHost: string;
let baseDomain: string = "";

if (Platform.OS === "web") {
  // Web development: use localhost only
  baseHost = "localhost";
  baseDomain = "http://localhost";
} else if (Platform.OS === "android") {
  // Android: use special Android emulator IP
  baseHost = "10.0.2.2";
  baseDomain = `http://${baseHost}`;
} else {
  // iOS and others: use localhost
  baseHost = "127.0.0.1";
  baseDomain = `http://${baseHost}`;
}

const portsToTry = [5002, 5001, 5000, 5003, 5004];

let detectedPort = 5001;
let isDetecting = false;
let detectionPromise: Promise<number> | null = null;

// Enhanced port detection with better timeout handling for React Native
export const detectBackendPort = async (): Promise<number> => {
  // Skip detection if explicit API URL is already set
  if (explicitApiUrl) {
    console.log(
      `[Port Detection] Skipped - using explicit API URL: ${explicitApiUrl}`,
    );
    return 5001; // Return dummy port, won't be used
  }

  // If already detecting, return the existing promise
  if (isDetecting && detectionPromise) {
    return detectionPromise;
  }

  // If already detected, return immediately
  if (detectedPort && detectedPort !== 5001) {
    return detectedPort;
  }

  isDetecting = true;

  detectionPromise = (async () => {
    for (const port of portsToTry) {
      try {
        const url = `${baseDomain}:${port}`;
        console.log(`[Port Detection] Trying ${url}...`);

        // Use Promise.race with timeout for better React Native compatibility
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 2000),
        );

        const fetchPromise = fetch(url, {
          method: "GET",
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (response instanceof Response && response.ok) {
          detectedPort = port;
          console.log(`✅ Backend detected on port ${port}`);
          isDetecting = false;
          return port;
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log(`[Port Detection] Port ${port} failed: ${errorMsg}`);
      }
    }

    console.warn(
      `⚠️  Could not detect backend (tried ${portsToTry.join(", ")}), using default port 5001`,
    );
    detectedPort = 5001;
    isDetecting = false;
    return 5001;
  })();

  return detectionPromise;
};

// Getter function for API_BASE_URL that uses current detected port
export const getApiBaseUrl = () => {
  const url = explicitApiUrl || `${baseDomain}:${detectedPort}`;
  console.log(`[API URL] Using: ${url}`);
  console.log(`[API URL] Env var set: ${explicitApiUrl ? "Yes" : "No"}`);
  console.log(`[API URL] Platform: ${Platform.OS}`);
  console.log(`[API URL] Detected Port: ${detectedPort}`);
  return url;
};

// For backward compatibility
export const API_BASE_URL = getApiBaseUrl();

export { detectedPort };

