const User = require("../models/User");
const Ride = require("../models/Ride");
const { getIO } = require("../socket-instance");

const formatDurationLabel = (minutes) => {
  const totalMinutes = Math.max(1, Math.round(Number(minutes) || 0));
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  return remainingMinutes > 0
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
};

// Toggle driver online/offline status
exports.toggleOnlineStatus = async (req, res) => {
  try {
    const { driverId, isOnline, lat, lng } = req.body;

    if (!driverId) {
      return res.status(400).json({ error: "Driver ID required" });
    }
    if (!req.user || String(req.user.userId) !== String(driverId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const driver = await User.findByIdAndUpdate(
      driverId,
      { isOnline, lat: lat || 28.6139, lng: lng || 77.209 },
      { new: true },
    );

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.status(200).json({
      driverId: driver._id,
      isOnline: driver.isOnline,
      message: isOnline ? "Driver is now online" : "Driver is now offline",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update driver location
exports.updateDriverLocation = async (req, res) => {
  try {
    const { driverId, lat, lng, locationName } = req.body;

    if (!driverId || lat === undefined || lng === undefined) {
      return res
        .status(400)
        .json({ error: "Driver ID, lat, and lng required" });
    }
    if (!req.user || String(req.user.userId) !== String(driverId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const driver = await User.findByIdAndUpdate(
      driverId,
      {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        currentLocation: locationName || "Unknown Location",
      },
      { new: true },
    );

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    console.log(
      `📍 Driver ${driver.name} location updated to ${locationName} (${lat}, ${lng})`,
    );

    res.status(200).json({
      driverId: driver._id,
      lat: driver.lat,
      lng: driver.lng,
      locationName: driver.currentLocation,
      message: "Location updated successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get available rides for driver
exports.getPendingRides = async (req, res) => {
  try {
    const { driverId } = req.params;
    if (!req.user || String(req.user.userId) !== String(driverId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const rides = await Ride.find({ status: { $in: ["bidding", "searching"] } })
      .populate("passengerId", "name rating")
      .sort({ createdAt: -1 })
      .limit(20);

    const formattedRides = rides.flatMap((ride) => {
      const passenger = ride.passengerId;
      const currentBid =
        ride.bids?.find((bid) => String(bid.driverId) === String(driverId)) ||
        null;
      const passengerIdValue =
        passenger && typeof passenger === "object" && "_id" in passenger
          ? passenger._id
          : ride.passengerId || null;
      const passengerName =
        passenger && typeof passenger === "object" && "name" in passenger
          ? passenger.name
          : ride.passengerDetails?.name || "";

      if (!passengerIdValue && !passengerName) {
        console.warn(`[Driver] Skipping orphan ride ${ride._id}`);
        return [];
      }

      return [{
        rideId: ride._id,
        passengerId: passengerIdValue,
        passengerName: passengerName || "Passenger",
        passengerRating:
          passenger && typeof passenger === "object" && "rating" in passenger
            ? passenger.rating
            : ride.passengerDetails?.rating || 5,
        pickup: ride.pickup,
        drop: ride.drop,
        estimatedFare: ride.estimatedFare,
        requestedRideType: ride.requestedRideType || "mini",
        distance: ride.routeMetrics?.distanceKm
          ? `${ride.routeMetrics.distanceKm.toFixed(1)} km`
          : "~5 km",
        eta: ride.routeMetrics?.estimatedDurationMinutes
          ? formatDurationLabel(ride.routeMetrics.estimatedDurationMinutes)
          : "~12 min",
        bidCount: ride.bids?.length || 0,
        status: ride.status,
        currentBid: currentBid
          ? {
              amount: currentBid.amount,
              etaMinutes: currentBid.etaMinutes,
              note: currentBid.note || "",
            }
          : null,
        lowestBid:
          ride.bids?.length > 0
            ? Math.min(...ride.bids.map((bid) => bid.amount || Infinity))
            : null,
        createdAt: ride.createdAt,
      }];
    });

    res.status(200).json({ rides: formattedRides });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Accept a ride request
exports.acceptRide = async (req, res) => {
  try {
    const { rideId, driverId, customPrice } = req.body;

    if (!rideId || !driverId) {
      return res.status(400).json({ error: "Ride ID and Driver ID required" });
    }
    if (!req.user || String(req.user.userId) !== String(driverId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (!["searching", "bidding"].includes(ride.status)) {
      return res.status(400).json({ error: "Ride no longer available" });
    }

    // Update ride with driver info
    ride.status = "accepted";
    ride.driverId = driverId;
    ride.actualFare = customPrice || ride.estimatedFare;
    ride.assignedDriver = {
      id: driver._id,
      name: driver.name,
      phone: driver.phone || "+91 9000000000",
      vehicle: driver.vehicle || "Swift DZire",
      vehicleNumber: driver.vehicleNumber || "Plate pending",
      rating: driver.rating,
      lat: driver.lat,
      lng: driver.lng,
    };
    ride.timeline.push({
      status: "accepted",
      at: new Date(),
    });
    if (Array.isArray(ride.bids)) {
      ride.bids.forEach((bid) => {
        bid.status =
          String(bid.driverId) === String(driverId) ? "selected" : "declined";
      });
    }

    await ride.save();

    // Emit real-time event to passenger (in ride room)
    const io = getIO();
    if (io) {
      io.to(rideId.toString()).emit("ride-status", {
        rideId: ride._id.toString(),
        status: "accepted",
        driverId: driver._id.toString(),
        timestamp: new Date().toISOString(),
      });
      io.to(rideId.toString()).emit("driver-accepted", {
        rideId: ride._id.toString(),
        driverId: driver._id.toString(),
        driverName: driver.name,
        driverPhone: driver.phone || "+91 9000000000",
        vehicle: driver.vehicle || "Swift DZire",
        vehicleNumber: driver.vehicleNumber || "Plate pending",
        rating: driver.rating,
        lat: driver.lat,
        lng: driver.lng,
        fare: ride.actualFare,
        timestamp: new Date().toISOString(),
      });
      console.log(`[Ride] Driver ${driver.name} accepted ride ${rideId}`);
    }

    res.status(200).json({
      success: true,
      rideId: ride._id,
      status: ride.status,
      message: "Ride accepted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reject a ride request
exports.rejectRide = async (req, res) => {
  try {
    const { rideId } = req.body;

    if (!rideId) {
      return res.status(400).json({ error: "Ride ID required" });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Just remove ride from pending (keep searching for other drivers)
    res.status(200).json({
      success: true,
      rideId,
      message: "Ride rejected",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update driver location
exports.updateLocation = async (req, res) => {
  try {
    const { driverId, lat, lng } = req.body;

    if (!driverId || lat === undefined || lng === undefined) {
      return res
        .status(400)
        .json({ error: "Driver ID and coordinates required" });
    }

    const driver = await User.findByIdAndUpdate(
      driverId,
      { lat, lng },
      { new: true },
    );

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.status(200).json({
      success: true,
      driverId,
      lat: driver.lat,
      lng: driver.lng,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get driver earnings
exports.getEarnings = async (req, res) => {
  try {
    const { driverId } = req.params;
    if (!req.user || String(req.user.userId) !== String(driverId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Get completed rides for this driver
    const completedRides = await Ride.find({
      driverId,
      status: "completed",
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRides = completedRides.filter(
      (ride) => new Date(ride.updatedAt) >= today,
    );

    const todayEarnings = todayRides.reduce(
      (sum, ride) => sum + (ride.actualFare || ride.estimatedFare),
      0,
    );

    const totalEarnings = completedRides.reduce(
      (sum, ride) => sum + (ride.actualFare || ride.estimatedFare),
      0,
    );

    res.status(200).json({
      driverId,
      todayEarnings: Math.round(todayEarnings * 100) / 100,
      todayTrips: todayRides.length,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalTrips: completedRides.length,
      rating: driver.rating,
      acceptanceRate: driver.acceptanceRate,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get driver ride history
exports.getDriverRideHistory = async (req, res) => {
  try {
    const { driverId } = req.params;
    if (!req.user || String(req.user.userId) !== String(driverId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const rides = await Ride.find({ driverId })
      .populate("passengerId", "name rating")
      .sort({ createdAt: -1 })
      .limit(20);

    const formattedRides = rides.map((ride) => ({
      rideId: ride._id,
      passengerName: ride.passengerId?.name || "Unknown",
      passengerRating: ride.passengerId?.rating || 5,
      pickup: ride.pickup,
      drop: ride.drop,
      fare: ride.actualFare || ride.estimatedFare,
      status: ride.status,
      date: ride.createdAt,
      distance: "~5 km",
    }));

    res.status(200).json({ rides: formattedRides });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get active trips (for navigation)
exports.getActiveTrips = async (req, res) => {
  try {
    const { driverId } = req.params;
    if (!req.user || String(req.user.userId) !== String(driverId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const activeRides = await Ride.find({
      driverId,
      status: { $in: ["accepted", "arriving", "on_trip"] },
    }).populate("passengerId", "name phone rating");

    const trips = activeRides.map((ride) => ({
      rideId: ride._id,
      status: ride.status,
      passengerName: ride.passengerId?.name || "Unknown",
      passengerPhone: ride.passengerId?.phone || "+91 9000000000",
      passengerRating: ride.passengerId?.rating || 5,
      pickup: ride.pickup,
      drop: ride.drop,
      estimatedFare: ride.actualFare || ride.estimatedFare,
    }));

    res.status(200).json({ trips });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update ride status (driver marking pickup/dropoff)
exports.updateRideStatus = async (req, res) => {
  try {
    const { rideId, status } = req.body;

    if (!rideId || !status) {
      return res.status(400).json({ error: "Ride ID and status required" });
    }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }
    if (!req.user || String(ride.driverId) !== String(req.user.userId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    ride.status = status;

    ride.timeline.push({
      status,
      at: new Date(),
    });

    // If completing, set actual fare
    if (status === "completed" && !ride.actualFare) {
      ride.actualFare = ride.estimatedFare;
    }

    await ride.save();

    if (status === "completed" && ride.driverId) {
      await User.findByIdAndUpdate(ride.driverId, {
        $inc: {
          totalEarnings: ride.actualFare || ride.estimatedFare || 0,
          totalRides: 1,
        },
      });
    }

    const io = getIO();
    if (io) {
      io.to(rideId.toString()).emit("ride-status", {
        rideId: ride._id.toString(),
        status,
        driverId: ride.driverId?.toString?.() || "",
        timestamp: new Date().toISOString(),
      });

      if (status === "on_trip") {
        io.to(rideId.toString()).emit("trip-started", {
          rideId: ride._id.toString(),
          driverId: ride.driverId?.toString?.() || "",
          tripStartTime: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });
      }

      if (status === "completed") {
        io.to(rideId.toString()).emit("trip-completed", {
          rideId: ride._id.toString(),
          driverId: ride.driverId?.toString?.() || "",
          fare: ride.actualFare || ride.estimatedFare,
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.status(200).json({
      success: true,
      rideId,
      status,
      message: `Ride status updated to ${status}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
