import { getApiBaseUrl } from "@/constants/api";
import { io, Socket } from "socket.io-client";

let passengerSocket: Socket | null = null;

export function getPassengerSocket(): Socket {
  if (!passengerSocket) {
    passengerSocket = io(getApiBaseUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    } as any);

    passengerSocket.on("connect", () => {
      console.log("✓ Passenger socket connected");
    });

    passengerSocket.on("connect_error", (error) => {
      console.error("✗ Passenger socket error:", error);
    });

    passengerSocket.on("disconnect", (reason) => {
      console.warn("Passenger socket disconnected:", reason);
    });
  }

  return passengerSocket;
}

export function disconnectPassengerSocket() {
  if (passengerSocket) {
    passengerSocket.disconnect();
    passengerSocket = null;
  }
}

// ============ RIDE ROOM EVENTS ============

export const joinRideRoom = (rideId: string, passengerId?: string) => {
  const socket = getPassengerSocket();
  socket.emit("join-ride", { rideId, passengerId });
};

export const listenForRideMarketUpdates = (
  callback: (payload: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("ride-market-updated", callback);
  return () => socket.off("ride-market-updated", callback);
};

export const listenForRideBidUpdates = (
  callback: (payload: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("ride-bid-updated", callback);
  return () => socket.off("ride-bid-updated", callback);
};

export const listenForRideMessages = (
  callback: (payload: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("ride-message", callback);
  return () => socket.off("ride-message", callback);
};

export const emitTypingStatus = (payload: {
  rideId: string;
  senderType: "passenger" | "driver";
  senderId: string;
  isTyping: boolean;
}) => {
  const socket = getPassengerSocket();
  socket.emit("ride-typing", payload);
};

export const listenForTypingStatus = (
  callback: (payload: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("ride-typing", callback);
  return () => socket.off("ride-typing", callback);
};

export const emitMessageSeen = (payload: {
  rideId: string;
  messageIds: string[];
  seenBy: "passenger" | "driver";
}) => {
  const socket = getPassengerSocket();
  socket.emit("ride-message-seen", payload);
};

export const listenForMessageReceipts = (
  callback: (payload: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("ride-message-receipt", callback);
  return () => socket.off("ride-message-receipt", callback);
};

// ============ RIDE STATUS EVENTS ============

export const listenForRideStatus = (
  callback: (status: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("ride-status", callback);

  // Return unsubscribe function
  return () => {
    socket.off("ride-status", callback);
  };
};

export const listenForDriverAccepted = (
  callback: (data: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("driver-accepted", callback);

  return () => {
    socket.off("driver-accepted", callback);
  };
};

export const listenForTripStarted = (
  callback: (data: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("trip-started", callback);

  return () => {
    socket.off("trip-started", callback);
  };
};

export const listenForTripCompleted = (
  callback: (data: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("trip-completed", callback);

  return () => {
    socket.off("trip-completed", callback);
  };
};

// ============ DRIVER LOCATION EVENTS ============

export const listenForDriverLocation = (
  callback: (location: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("driver-location", callback);

  return () => {
    socket.off("driver-location", callback);
  };
};

// ============ DRIVER STATUS EVENTS ============

export const listenForDriverStatusUpdates = (
  callback: (status: any) => void,
): (() => void) => {
  const socket = getPassengerSocket();
  socket.on("driver-status-update", callback);

  return () => {
    socket.off("driver-status-update", callback);
  };
};

// ============ RIDE REQUEST EVENTS ============

export const emitNewRideRequest = (payload: {
  rideId: string;
  passengerId: string;
  passengerName: string;
  pickupLocation: string;
  pickupLat?: number;
  pickupLng?: number;
  drop: string;
  dropLat?: number;
  dropLng?: number;
  fare: number;
}) => {
  const socket = getPassengerSocket();
  socket.emit("new-ride-request", payload);
};

// ============ RIDE SIMULATION EVENTS ============

export const startRideSimulation = (rideId: string) => {
  const socket = getPassengerSocket();
  socket.emit("start-ride-simulation", { rideId });
};

// ============ HEALTH CHECK ============

export const sendPing = (callback?: (response: any) => void) => {
  const socket = getPassengerSocket();
  if (callback) {
    socket.emit("ping", callback);
  } else {
    socket.emit("ping", () => {
      console.log("Passenger socket pong");
    });
  }
};
