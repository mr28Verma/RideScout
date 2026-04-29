import { getApiBaseUrl } from "@/constants/api";
import { io, Socket } from "socket.io-client";

let driverSocket: Socket | null = null;

export const getDriverSocket = (): Socket => {
  if (driverSocket && driverSocket.connected) {
    return driverSocket;
  }

  driverSocket = io(getApiBaseUrl(), {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  } as any);

  driverSocket.on("connect", () => {
    console.log("✓ Driver socket connected");
  });

  driverSocket.on("connect_error", (error) => {
    console.error("✗ Driver socket error:", error);
  });

  driverSocket.on("disconnect", (reason) => {
    console.warn("Driver socket disconnected:", reason);
  });

  return driverSocket;
};

export const disconnectDriverSocket = () => {
  if (driverSocket) {
    driverSocket.disconnect();
    driverSocket = null;
  }
};

// ============ DRIVER STATUS EVENTS ============

export const joinDriverRoom = (driverId: string) => {
  const socket = getDriverSocket();
  socket.emit("driver-join", { driverId });
};

export const joinDriverRideRoom = (rideId: string, driverId: string) => {
  const socket = getDriverSocket();
  socket.emit("join-ride", { rideId, driverId });
};

export const goOffline = (driverId: string) => {
  const socket = getDriverSocket();
  socket.emit("driver-offline", { driverId });
};

// ============ RIDE REQUEST EVENTS ============

export const listenForRideRequests = (callback: (ride: any) => void) => {
  const socket = getDriverSocket();
  socket.on("incoming-ride", callback);
  return () => socket.off("incoming-ride", callback);
};

export const stopListeningForRideRequests = () => {
  const socket = getDriverSocket();
  socket.off("incoming-ride");
};

export const listenForDriverStatusUpdates = (
  callback: (status: any) => void,
) => {
  const socket = getDriverSocket();
  socket.on("driver-status-update", callback);
};

export const listenForRideBidSelected = (callback: (payload: any) => void) => {
  const socket = getDriverSocket();
  socket.on("ride-bid-selected", callback);
  return () => socket.off("ride-bid-selected", callback);
};

export const listenForRideMarketUpdates = (callback: (payload: any) => void) => {
  const socket = getDriverSocket();
  socket.on("ride-market-updated", callback);
  return () => socket.off("ride-market-updated", callback);
};

export const listenForRideMessages = (callback: (payload: any) => void) => {
  const socket = getDriverSocket();
  socket.on("ride-message", callback);
  return () => socket.off("ride-message", callback);
};

// ============ REAL-TIME LOCATION EVENTS ============

export const sendLocationUpdate = (
  driverId: string,
  rideId: string | null,
  lat: number,
  lng: number,
  heading?: number,
) => {
  const socket = getDriverSocket();
  socket.emit("driver-location-update", {
    driverId,
    rideId,
    lat,
    lng,
    heading: heading || 0,
  });
};

export const listenForLocationConfirmation = (
  callback: (confirmation: any) => void,
) => {
  const socket = getDriverSocket();
  socket.on("driver-location-confirmed", callback);
};

// ============ RIDE EVENTS ============

export const emitRideAccepted = (
  rideId: string,
  driverId: string,
  driverName: string,
  vehicle: string,
  rating: number,
) => {
  const socket = getDriverSocket();
  socket.emit("ride-accepted", {
    rideId,
    driverId,
    driverName,
    vehicle,
    rating,
  });
};

export const listenForRideAcceptedConfirmation = (
  callback: (data: any) => void,
) => {
  const socket = getDriverSocket();
  socket.on("ride-accepted", callback);
};

export const emitTripStarted = (rideId: string, driverId: string) => {
  const socket = getDriverSocket();
  socket.emit("trip-started", {
    rideId,
    driverId,
    tripStartTime: new Date().toISOString(),
  });
};

export const listenForTripStarted = (callback: (data: any) => void) => {
  const socket = getDriverSocket();
  socket.on("trip-started", callback);
};

export const emitTripCompleted = (
  rideId: string,
  driverId: string,
  fare: number,
  rating?: number,
  feedback?: string,
) => {
  const socket = getDriverSocket();
  socket.emit("trip-completed", {
    rideId,
    driverId,
    fare,
    rating: rating || 5,
    feedback: feedback || "",
  });
};

export const listenForTripCompleted = (callback: (data: any) => void) => {
  const socket = getDriverSocket();
  socket.on("trip-completed", callback);
};

// ============ RIDE STATUS EVENTS ============

export const listenForRideStatus = (callback: (status: any) => void) => {
  const socket = getDriverSocket();
  socket.on("ride-status", callback);
};

export const emitRideStatusUpdate = (
  rideId: string,
  status: string,
  driverId?: string,
) => {
  const socket = getDriverSocket();
  socket.emit("update-ride-status", {
    rideId,
    status,
    driverId: driverId || "",
  });
};

// ============ HEALTH CHECK ============

export const sendPing = (callback?: (response: any) => void) => {
  const socket = getDriverSocket();
  if (callback) {
    socket.emit("ping", callback);
  } else {
    socket.emit("ping", () => {
      console.log("Driver socket pong");
    });
  }
};
