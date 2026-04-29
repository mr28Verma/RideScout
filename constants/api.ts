import Constants from "expo-constants";
import { Platform } from "react-native";

const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL;

export const API_JSON_HEADERS = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

export const API_GET_HEADERS = {
  Accept: "application/json",
  "ngrok-skip-browser-warning": "true",
};

const extractExpoHost = () => {
  const candidates = [
    (Constants as any)?.expoConfig?.hostUri,
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri,
    (Constants as any)?.manifest?.debuggerHost,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const host = candidate.split(":")[0]?.trim();
    if (host) {
      return host;
    }
  }

  return "";
};

let baseHost: string;
let baseDomain = "";
const expoHost = extractExpoHost();

if (Platform.OS === "web") {
  baseHost = "localhost";
  baseDomain = "http://localhost";
} else if (Platform.OS === "android") {
  baseHost = expoHost || "10.0.2.2";
  baseDomain = `http://${baseHost}`;
} else {
  baseHost = expoHost || "127.0.0.1";
  baseDomain = `http://${baseHost}`;
}

const portsToTry = [5002, 5001, 5000, 5003, 5004];

let detectedPort = 5001;
let isDetecting = false;
let detectionPromise: Promise<number> | null = null;
let resolvedApiUrl = explicitApiUrl || "";

const isReachable = async (url: string) => {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 2500),
    );

    const fetchPromise = fetch(url, {
      method: "GET",
      headers: API_GET_HEADERS,
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    return response instanceof Response && response.ok;
  } catch {
    return false;
  }
};

export const detectBackendPort = async (): Promise<number> => {
  if (explicitApiUrl) {
    const explicitIsReachable = await isReachable(explicitApiUrl);

    if (explicitIsReachable) {
      resolvedApiUrl = explicitApiUrl;
      console.log(`[Port Detection] Using explicit API URL: ${explicitApiUrl}`);
      return 5001;
    }

    console.warn(
      `[Port Detection] Explicit API URL unreachable, falling back to local detection: ${explicitApiUrl}`,
    );
  }

  if (isDetecting && detectionPromise) {
    return detectionPromise;
  }

  if (detectedPort && detectedPort !== 5001 && resolvedApiUrl) {
    return detectedPort;
  }

  isDetecting = true;

  detectionPromise = (async () => {
    for (const port of portsToTry) {
      try {
        const url = `${baseDomain}:${port}`;
        console.log(`[Port Detection] Trying ${url}...`);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 2000),
        );

        const fetchPromise = fetch(url, {
          method: "GET",
          headers: API_GET_HEADERS,
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (response instanceof Response && response.ok) {
          detectedPort = port;
          resolvedApiUrl = url;
          console.log(`[Port Detection] Backend detected on port ${port}`);
          isDetecting = false;
          return port;
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log(`[Port Detection] Port ${port} failed: ${errorMsg}`);
      }
    }

    console.warn(
      `[Port Detection] Could not detect backend (tried ${portsToTry.join(", ")}), using default port 5001`,
    );
    detectedPort = 5001;
    resolvedApiUrl = explicitApiUrl || `${baseDomain}:${detectedPort}`;
    isDetecting = false;
    return 5001;
  })();

  return detectionPromise;
};

export const getApiBaseUrl = () => {
  const url =
    resolvedApiUrl || explicitApiUrl || `${baseDomain}:${detectedPort}`;
  console.log(`[API URL] Using: ${url}`);
  console.log(`[API URL] Env var set: ${explicitApiUrl ? "Yes" : "No"}`);
  console.log(`[API URL] Platform: ${Platform.OS}`);
  console.log(`[API URL] Expo Host: ${expoHost || "Unavailable"}`);
  console.log(`[API URL] Detected Port: ${detectedPort}`);
  return url;
};

export const API_BASE_URL = getApiBaseUrl();

export { detectedPort };
