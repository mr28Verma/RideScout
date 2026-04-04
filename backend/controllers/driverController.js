const User = require("../models/User");
const Ride = require("../models/Ride");
const { getIO } = require("../socket-instance");

// Toggle driver online/offline status
exports.toggleOnlineStatus = async (req, res) => {
  try {
    const { driverId, isOnline, lat, lng } = req.body;

    if (!driverId) {
      return res.status(400).json({ error: "Driver ID required" });
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

    // Find rides that are in "searching" status
    const rides = await Ride.find({ status: "searching" })
      .populate("passengerId", "name rating")
      .sort({ createdAt: -1 })
      .limit(10);

    // Map to include passenger details
    const formattedRides = rides.map((ride) => ({
      rideId: ride._id,
      passengerId: ride.passengerId._id,
      passengerName: ride.passengerId.name,
      passengerRating: ride.passengerId.rating,
      pickup: ride.pickup,
      drop: ride.drop,
      estimatedFare: ride.estimatedFare,
      distance: "~5 km",
      eta: "~12 min",
      createdAt: ride.createdAt,
    }));

    res.status(200).json({ rides: formattedRides });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Accept a ride request
exports.acceptRide = async (req, res) => {
  try {
    const { rideId, driverId } = req.body;

    if (!rideId || !driverId) {
      return res.status(400).json({ error: "Ride ID and Driver ID required" });
    }

    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (ride.status !== "searching") {
      return res.status(400).json({ error: "Ride no longer available" });
    }

    // Update ride with driver info
    ride.status = "accepted";
    ride.driverId = driverId;
    ride.assignedDriver = {
      id: driver._id,
      name: driver.name,
      vehicle: driver.vehicle || "Swift DZire",
      rating: driver.rating,
      lat: driver.lat,
      lng: driver.lng,
    };
    ride.timeline.push({
      status: "accepted",
      at: new Date(),
    });

    await ride.save();

    // Emit real-time event to passenger (in ride room)
    const io = getIO();
    if (io) {
      io.to(rideId.toString()).emit("driver-accepted", {
        rideId: ride._id.toString(),
        driverId: driver._id.toString(),
        driverName: driver.name,
        vehicle: driver.vehicle || "Swift DZire",
        rating: driver.rating,
        lat: driver.lat,
        lng: driver.lng,
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

    const activeRides = await Ride.find({
      driverId,
      status: { $in: ["accepted", "on_trip"] },
    }).populate("passengerId", "name phone rating");

    const trips = activeRides.map((ride) => ({
      rideId: ride._id,
      status: ride.status,
      passengerName: ride.passengerId?.name || "Unknown",
      passengerPhone: ride.passengerId?.phone || "+91 9000000000",
      passengerRating: ride.passengerId?.rating || 5,
      pickup: ride.pickup,
      drop: ride.drop,
      estimatedFare: ride.estimatedFare,
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

    const ride = await Ride.findByIdAndUpdate(
      rideId,
      { status },
      { new: true },
    );

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    ride.timeline.push({
      status,
      at: new Date(),
    });

    // If completing, set actual fare
    if (status === "completed" && !ride.actualFare) {
      ride.actualFare = ride.estimatedFare;
    }

    await ride.save();

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
