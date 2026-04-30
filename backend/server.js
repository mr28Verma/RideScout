require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const { setIO } = require("./socket-instance");
const authRoutes = require("./routes/authRoutes");
const rideRoutes = require("./routes/rideRoutes");
const driverRoutes = require("./routes/driverRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (_origin, callback) => callback(null, true),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: false,
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

// Make io available to controllers
setIO(io);

const PORT = parseInt(process.env.PORT || 5000, 10);

// Real-time tracking maps
const rideIntervals = new Map();
const driverSockets = new Map();
const rideRooms = new Map();
const driverLocations = new Map();
const activeDrivers = new Map();
const rideTypingState = new Map();

// Socket.IO Connection Handler
io.on("connection", (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  // ============ PASSENGER EVENTS ============
  socket.on("join-ride", ({ rideId, passengerId, driverId }) => {
    if (!rideId) return;
    socket.join(rideId);

    if (!rideRooms.has(rideId)) {
      rideRooms.set(rideId, {
        passengers: new Set(),
        drivers: new Set(),
        createdAt: new Date(),
      });
    }

    const room = rideRooms.get(rideId);
    if (passengerId) {
      room.passengers.add(passengerId);
    }
    if (driverId) {
      room.drivers.add(driverId);
    }

    if (driverLocations.has(rideId)) {
      socket.emit("driver-location", driverLocations.get(rideId));
    }

    console.log(
      `[Ride] Room join for ride ${rideId} passenger=${passengerId || "-"} driver=${driverId || "-"}`,
    );
  });

  socket.on("ride-typing", ({ rideId, senderType, senderId, isTyping }) => {
    if (!rideId || !senderType || !senderId) return;

    if (!rideTypingState.has(rideId)) {
      rideTypingState.set(rideId, new Map());
    }

    const roomTypingState = rideTypingState.get(rideId);
    const typingKey = `${senderType}:${senderId}`;

    if (isTyping) {
      roomTypingState.set(typingKey, {
        senderType,
        senderId,
        isTyping: true,
        timestamp: new Date().toISOString(),
      });
    } else {
      roomTypingState.delete(typingKey);
    }

    io.to(rideId).emit("ride-typing", {
      rideId,
      senderType,
      senderId,
      isTyping: Boolean(isTyping),
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("ride-message-seen", ({ rideId, messageIds, seenBy }) => {
    if (!rideId || !Array.isArray(messageIds) || messageIds.length === 0 || !seenBy) {
      return;
    }

    io.to(rideId).emit("ride-message-receipt", {
      rideId,
      messageIds,
      status: "seen",
      seenBy,
      timestamp: new Date().toISOString(),
    });
  });

  // ============ DRIVER EVENTS ============
  socket.on("driver-join", ({ driverId }) => {
    if (!driverId) return;

    driverSockets.set(driverId, socket.id);
    activeDrivers.set(driverId, {
      socketId: socket.id,
      joinedAt: new Date(),
      isOnline: true,
    });

    socket.join(`driver-${driverId}`);
    socket.join("drivers-room");

    io.emit("driver-status-update", {
      driverId,
      isOnline: true,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Driver] Driver ${driverId} joined (online)`);
  });

  socket.on("driver-offline", ({ driverId }) => {
    if (!driverId) return;

    driverSockets.delete(driverId);
    activeDrivers.delete(driverId);
    driverLocations.delete(driverId);
    socket.leave(`driver-${driverId}`);

    io.emit("driver-status-update", {
      driverId,
      isOnline: false,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Driver] Driver ${driverId} is offline`);
  });

  socket.on(
    "driver-location-update",
    ({ driverId, rideId, lat, lng, heading }) => {
      if (!driverId || lat === undefined || lng === undefined) return;

      const locationData = {
        driverId,
        rideId,
        lat,
        lng,
        heading: heading || 0,
        timestamp: new Date().toISOString(),
      };

      driverLocations.set(rideId || driverId, locationData);

      if (rideId) {
        io.to(rideId).emit("driver-location", locationData);
      }

      io.to(`driver-${driverId}`).emit("driver-location-confirmed", {
        driverId,
        lat,
        lng,
        timestamp: new Date().toISOString(),
      });

      console.log(`[Location] Driver ${driverId} at (${lat}, ${lng})`);
    },
  );

  // ============ RIDE EVENTS ============
  socket.on(
    "new-ride-request",
    ({
      rideId,
      passengerId,
      passengerName,
      pickupLocation,
      drop,
      fare,
      pickupLat,
      pickupLng,
    }) => {
      io.to("drivers-room").emit("incoming-ride", {
        rideId,
        passengerId,
        passengerName,
        pickup: pickupLocation,
        pickupLat: pickupLat || 28.6139,
        pickupLng: pickupLng || 77.209,
        drop,
        fare,
        timestamp: new Date().toISOString(),
      });

      console.log(`[Ride] New ride request ${rideId} from ${passengerName}`);
    },
  );

  socket.on("update-ride-status", ({ rideId, status, driverId }) => {
    if (!rideId || !status) return;

    const statusUpdate = {
      rideId,
      status,
      driverId,
      timestamp: new Date().toISOString(),
    };

    io.to(rideId).emit("ride-status", statusUpdate);
    console.log(`[Ride] Ride ${rideId} status: ${status}`);
  });

  socket.on(
    "ride-accepted",
    ({ rideId, driverId, driverName, vehicle, rating }) => {
      const rideData = {
        rideId,
        driverId,
        driverName,
        vehicle,
        rating,
        timestamp: new Date().toISOString(),
      };

      io.to(rideId).emit("driver-accepted", rideData);

      if (rideRooms.has(rideId)) {
        const room = rideRooms.get(rideId);
        room.drivers.add(driverId);
      }

      console.log(`[Ride] Ride ${rideId} accepted by ${driverName}`);
    },
  );

  socket.on("trip-started", ({ rideId, driverId, tripStartTime }) => {
    io.to(rideId).emit("trip-started", {
      rideId,
      driverId,
      tripStartTime,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Trip] Trip ${rideId} started`);
  });

  socket.on(
    "trip-completed",
    ({ rideId, driverId, fare, rating, feedback }) => {
      io.to(rideId).emit("trip-completed", {
        rideId,
        driverId,
        fare,
        rating,
        feedback,
        timestamp: new Date().toISOString(),
      });

      rideRooms.delete(rideId);
      driverLocations.delete(rideId);
      rideTypingState.delete(rideId);

      console.log(`[Trip] Trip ${rideId} completed`);
    },
  );

  // ============ LEGACY SIMULATION ============
  socket.on("start-ride-simulation", ({ rideId }) => {
    if (!rideId || rideIntervals.has(rideId)) return;

    const statuses = ["searching", "accepted", "on_trip", "completed"];
    let index = 0;
    let lat = 28.6139;
    let lng = 77.209;

    const interval = setInterval(() => {
      if (index >= statuses.length) {
        clearInterval(interval);
        rideIntervals.delete(rideId);
        return;
      }

      const status = statuses[index];
      lat += 0.0008;
      lng += 0.0007;

      io.to(rideId).emit("ride-status", {
        rideId,
        status,
        timestamp: new Date().toISOString(),
      });

      io.to(rideId).emit("driver-location", {
        rideId,
        lat,
        lng,
        heading: 45 + index * 15,
        timestamp: new Date().toISOString(),
      });

      index += 1;
    }, 6000);

    rideIntervals.set(rideId, interval);
  });

  // ============ CONNECTION CLEANUP ============
  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);

    for (const [driverId, socketId] of driverSockets.entries()) {
      if (socketId === socket.id) {
        driverSockets.delete(driverId);
        activeDrivers.delete(driverId);
        driverLocations.delete(driverId);

        io.emit("driver-status-update", {
          driverId,
          isOnline: false,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Driver] Driver ${driverId} disconnected`);
      }
    }

    for (const [rideId, room] of rideRooms.entries()) {
      if (room.passengers.size === 0 && room.drivers.size === 0) {
        rideRooms.delete(rideId);
      }
    }
  });

  socket.on("ping", (callback) => {
    callback({ timestamp: new Date().toISOString() });
  });
});

// Express Routes
// CORS configuration that works with ngrok
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins for development
    callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  preflightContinue: false,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/", (_req, res) => {
  res.status(200).json({ message: "RideScout backend is running" });
});

app.get("/api/socket/stats", (_req, res) => {
  res.status(200).json({
    activeDrivers: activeDrivers.size,
    activeRides: rideRooms.size,
    timestamp: new Date().toISOString(),
  });
});

// Async initialization
(async () => {
  try {
    await connectDB();
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("Database connection error:", error);
  }

  const startServer = (port) => {
    httpServer
      .listen(port, "0.0.0.0", () => {
        console.log(`Server running on port ${port}`);
      })
      .on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Port ${port} in use, trying ${port + 1}...`);
          startServer(port + 1);
        } else {
          throw err;
        }
      });
  };

  startServer(PORT);
})();
