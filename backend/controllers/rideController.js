const Ride = require("../models/Ride");
const { getIO } = require("../socket-instance");

const MOCK_DRIVERS = [
  {
    id: "DRV-101",
    name: "Rahul",
    vehicle: "Swift DZire",
    rating: 4.9,
    lat: 28.6139,
    lng: 77.209,
  },
  {
    id: "DRV-102",
    name: "Amit",
    vehicle: "WagonR",
    rating: 4.7,
    lat: 28.6151,
    lng: 77.2015,
  },
  {
    id: "DRV-103",
    name: "Sana",
    vehicle: "Hyundai Aura",
    rating: 4.8,
    lat: 28.6192,
    lng: 77.2142,
  },
  {
    id: "DRV-104",
    name: "ABC Driver",
    vehicle: "Maruti Alto",
    rating: 4.6,
    lat: 31.2833, // Baddi, Himachal Pradesh
    lng: 76.55,
  },
];

const estimateFare = async (req, res) => {
  try {
    const { pickup, drop, pickupLat, pickupLng, dropLat, dropLng } = req.body;

    console.log("🔍 Estimate Fare Request:", {
      pickup,
      drop,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
    });

    if (!pickup || !drop) {
      return res.status(400).json({ message: "pickup and drop are required" });
    }

    // Calculate real distance using Haversine formula
    let distanceKm = 5; // Default fallback

    if (pickupLat && pickupLng && dropLat && dropLng) {
      const lat1 = parseFloat(pickupLat);
      const lon1 = parseFloat(pickupLng);
      const lat2 = parseFloat(dropLat);
      const lon2 = parseFloat(dropLng);

      console.log("📍 Coordinates:", {
        from: `${lat1}, ${lon1}`,
        to: `${lat2}, ${lon2}`,
      });

      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceKm = Math.round((R * c + Number.EPSILON) * 100) / 100; // Round to 2 decimals

      console.log("📏 Calculated Distance:", distanceKm, "km");
    } else {
      console.warn("⚠️ Missing coordinates, using default 5km:", {
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
      });
    }

    // Ensure minimum 3km and maximum 300km
    distanceKm = Math.max(3, Math.min(300, distanceKm));

    // Fare calculation - realistic India pricing
    const baseFare = 50; // Base fare in INR
    const perKm = 10; // Per km rate (reduced from 15)
    const perMinute = 1; // Per minute rate (reduced from 2)

    // Time component only significant for short trips
    // For long distances, use reduced time component
    let timeFare = 0;
    if (distanceKm <= 50) {
      // Short trips: use full time calculation
      timeFare = Math.round(distanceKm * 5 * perMinute);
    } else {
      // Long trips: minimal time component (fixed ₹100 per 50km)
      timeFare = Math.round((distanceKm / 50) * 100);
    }

    const distanceFare = Math.round(distanceKm * perKm);

    // Surge pricing only for short distances
    let surge = 1;
    if (distanceKm <= 5) surge = 1.2; // Short trips only
    // No surge for medium/long distances - they're already profitable

    const estimatedFare = Math.round(
      (baseFare + distanceFare + timeFare) * surge,
    );

    console.log("💰 Fare Breakdown:", {
      baseFare,
      distanceFare,
      timeFare,
      surge,
      estimatedFare,
      distanceKm,
    });

    return res.status(200).json({
      pickup,
      drop,
      distanceKm,
      estimatedFare,
      baseFare,
      distanceFare,
      timeFare,
      surge,
      currency: "INR",
    });
  } catch (error) {
    console.error("❌ Estimate Fare Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const listNearbyDrivers = async (req, res) => {
  try {
    const { pickupLat, pickupLng } = req.query;

    let availableDrivers = MOCK_DRIVERS;

    // Filter drivers by proximity if coordinates provided
    if (pickupLat && pickupLng) {
      const lat1 = parseFloat(pickupLat);
      const lng1 = parseFloat(pickupLng);
      const SEARCH_RADIUS_KM = 50; // Show drivers within 50km of pickup

      availableDrivers = MOCK_DRIVERS.filter((driver) => {
        const R = 6371; // Earth's radius in km
        const dLat = ((driver.lat - lat1) * Math.PI) / 180;
        const dLng = ((driver.lng - lng1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((driver.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;

        console.log(
          `📍 ${driver.name}: ${distanceKm.toFixed(1)}km from pickup`,
        );
        return distanceKm <= SEARCH_RADIUS_KM;
      });

      console.log(
        `🚗 Found ${availableDrivers.length} drivers within ${SEARCH_RADIUS_KM}km`,
      );
    }

    return res.status(200).json({ drivers: availableDrivers });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const bookRide = async (req, res) => {
  try {
    const { passengerId, pickup, drop, estimatedFare, paymentMethod } =
      req.body;

    if (!passengerId || !pickup || !drop || !estimatedFare) {
      return res.status(400).json({
        message: "passengerId, pickup, drop, and estimatedFare are required",
      });
    }

    const ride = await Ride.create({
      passengerId,
      pickup,
      drop,
      estimatedFare,
      paymentMethod: paymentMethod || "mock",
      status: "searching",
      assignedDriver: MOCK_DRIVERS[0],
      timeline: [{ status: "searching", at: new Date() }],
    });

    // Get passenger info for real-time notification
    const User = require("../models/User");
    const passenger = await User.findById(passengerId).select("name");
    const passengerName = passenger?.name || "Passenger";

    // Emit real-time event to all online drivers
    const io = getIO();
    if (io) {
      io.to("drivers-room").emit("incoming-ride", {
        rideId: ride._id.toString(),
        passengerId: passengerId,
        passengerName: passengerName,
        pickup: pickup,
        pickupLat: 28.6139,
        pickupLng: 77.209,
        drop: drop,
        fare: estimatedFare,
        distance: "~5 km",
        eta: "~12 min",
        timestamp: new Date().toISOString(),
      });
      console.log(`[Ride] Broadcasting new ride ${ride._id} to all drivers`);
    }

    return res.status(201).json({
      message: "Ride booked",
      ride,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getRideHistory = async (req, res) => {
  try {
    const { passengerId } = req.params;

    if (!passengerId) {
      return res.status(400).json({ message: "passengerId is required" });
    }

    const rides = await Ride.find({ passengerId })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({ rides });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  estimateFare,
  listNearbyDrivers,
  bookRide,
  getRideHistory,
};
