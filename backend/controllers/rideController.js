const Ride = require("../models/Ride");
const User = require("../models/User");
const { getIO } = require("../socket-instance");

const MOCK_DRIVERS = [
  {
    id: "DRV-101",
    name: "Rahul",
    phone: "+91 9876500011",
    vehicle: "Swift DZire",
    rating: 4.9,
    lat: 28.6139,
    lng: 77.209,
  },
  {
    id: "DRV-102",
    name: "Amit",
    phone: "+91 9876500012",
    vehicle: "WagonR",
    rating: 4.7,
    lat: 28.6151,
    lng: 77.2015,
  },
  {
    id: "DRV-103",
    name: "Sana",
    phone: "+91 9876500013",
    vehicle: "Hyundai Aura",
    rating: 4.8,
    lat: 28.6192,
    lng: 77.2142,
  },
  {
    id: "DRV-104",
    name: "ABC Driver",
    phone: "+91 9876500014",
    vehicle: "Maruti Alto",
    rating: 4.6,
    lat: 31.2833,
    lng: 76.55,
  },
];

const OPEN_RIDE_STATUSES = ["bidding", "searching"];
const PASSENGER_ACTIVE_STATUSES = ["searching", "accepted", "on_trip"];
const PASSENGER_RESUMABLE_STATUSES = ["bidding", "searching", "accepted", "arriving", "on_trip"];

const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const numbers = [lat1, lon1, lat2, lon2].map((value) => Number(value));
  if (numbers.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [aLat, aLon, bLat, bLon] = numbers;
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c + Number.EPSILON) * 100) / 100;
};

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

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

const matchesRoute = (ride, pickup, drop, pickupLat, pickupLng, dropLat, dropLng) => {
  const pickupText = normalizeText(pickup);
  const dropText = normalizeText(drop);
  const ridePickupText = normalizeText(ride.pickup);
  const rideDropText = normalizeText(ride.drop);

  const textMatch =
    (pickupText && ridePickupText.includes(pickupText.slice(0, 10))) ||
    (ridePickupText && pickupText.includes(ridePickupText.slice(0, 10)));

  const dropTextMatch =
    (dropText && rideDropText.includes(dropText.slice(0, 10))) ||
    (rideDropText && dropText.includes(rideDropText.slice(0, 10)));

  const pickupDistance = haversineDistanceKm(
    ride.pickupLat,
    ride.pickupLng,
    pickupLat,
    pickupLng,
  );
  const dropDistance = haversineDistanceKm(
    ride.dropLat,
    ride.dropLng,
    dropLat,
    dropLng,
  );

  const coordinateMatch =
    pickupDistance !== null &&
    dropDistance !== null &&
    pickupDistance <= 6 &&
    dropDistance <= 8;

  return coordinateMatch || (textMatch && dropTextMatch);
};

const serializeBid = (bid) => ({
  driverId: String(bid.driverId),
  driverName: bid.driverName,
  driverPhone: bid.driverPhone || "+91 9000000000",
  vehicle: bid.vehicle,
  rating: bid.rating,
  amount: bid.amount,
  etaMinutes: bid.etaMinutes,
  note: bid.note || "",
  status: bid.status,
  createdAt: bid.createdAt,
});

const serializeMessage = (message) => ({
  senderType: message.senderType,
  senderId: String(message.senderId),
  senderName: message.senderName,
  text: message.text,
  createdAt: message.createdAt,
});

const serializeRideMarket = (ride) => ({
  rideId: String(ride._id),
  passengerId: String(ride.passengerId),
  pickup: ride.pickup,
  drop: ride.drop,
  pickupLat: ride.pickupLat,
  pickupLng: ride.pickupLng,
  dropLat: ride.dropLat,
  dropLng: ride.dropLng,
  estimatedFare: ride.estimatedFare,
  actualFare: ride.actualFare,
  requestedRideType: ride.requestedRideType,
  paymentMethod: ride.paymentMethod,
  status: ride.status,
  routeMetrics: ride.routeMetrics || {},
  assignedDriver: ride.assignedDriver || null,
  passengerRating: ride.passengerRating || null,
  bids: (ride.bids || []).map(serializeBid).sort((a, b) => a.amount - b.amount),
  messages: (ride.messages || []).map(serializeMessage),
  createdAt: ride.createdAt,
  updatedAt: ride.updatedAt,
});

const serializeRideRecord = (ride) => ({
  _id: String(ride._id),
  pickup: ride.pickup,
  drop: ride.drop,
  estimatedFare: ride.actualFare || ride.estimatedFare,
  paymentMethod: ride.paymentMethod,
  status: ride.status,
  createdAt: ride.createdAt,
});

const emitRideMarketUpdate = (ride, extra = {}) => {
  const io = getIO();
  if (!io) return;

  io.to(String(ride._id)).emit("ride-market-updated", {
    rideId: String(ride._id),
    market: serializeRideMarket(ride),
    ...extra,
  });
};

const emitRideBidUpdate = (ride, bid, extra = {}) => {
  const io = getIO();
  if (!io) return;

  io.to(String(ride._id)).emit("ride-bid-updated", {
    rideId: String(ride._id),
    bid: serializeBid(bid),
    bids: (ride.bids || []).map(serializeBid).sort((a, b) => a.amount - b.amount),
    ...extra,
  });
};

const emitRideMessage = (rideId, message) => {
  const io = getIO();
  if (!io) return;

  io.to(String(rideId)).emit("ride-message", {
    rideId: String(rideId),
    message: serializeMessage(message),
  });
};

const calculateRoute = (pickupLat, pickupLng, dropLat, dropLng) => {
  let distanceKm = 5;

  const distance = haversineDistanceKm(
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
  );

  if (distance !== null) {
    const roadFactor =
      distance <= 3
        ? 1.18
        : distance <= 15
          ? 1.24
          : distance <= 40
            ? 1.18
            : distance <= 120
              ? 1.12
              : 1.08;
    distanceKm = Math.max(
      2,
      Math.min(300, Math.round(distance * roadFactor * 100) / 100),
    );
  }

  const baseFare = 50;
  const averageSpeedKmph =
    distanceKm <= 6
      ? 18
      : distanceKm <= 20
        ? 26
        : distanceKm <= 60
          ? 42
          : distanceKm <= 140
            ? 52
            : 60;
  const trafficBuffer =
    distanceKm <= 12 ? 10 : distanceKm <= 35 ? 14 : distanceKm <= 120 ? 18 : 12;
  const estimatedDurationMinutes = Math.max(
    8,
    Math.round((distanceKm / averageSpeedKmph) * 60 + trafficBuffer),
  );
  const perKm = distanceKm <= 6 ? 12 : distanceKm <= 20 ? 11 : 10;
  const perMinute = 1;

  const distanceFare = Math.round(distanceKm * perKm);
  const timeFare = Math.round(estimatedDurationMinutes * perMinute);
  const surge = distanceKm <= 4 ? 1.18 : distanceKm <= 10 ? 1.08 : 1;
  const estimatedFare = Math.round((baseFare + distanceFare + timeFare) * surge);

  return {
    distanceKm,
    estimatedDurationMinutes,
    estimatedFare,
    baseFare,
    distanceFare,
    timeFare,
    surge,
  };
};

const estimateFare = async (req, res) => {
  try {
    const { pickup, drop, pickupLat, pickupLng, dropLat, dropLng } = req.body;

    if (!pickup || !drop) {
      return res.status(400).json({ message: "pickup and drop are required" });
    }

    const route = calculateRoute(
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
    );

    return res.status(200).json({
      pickup,
      drop,
      distanceKm: route.distanceKm,
      estimatedDurationMinutes: route.estimatedDurationMinutes,
      estimatedFare: route.estimatedFare,
      baseFare: route.baseFare,
      distanceFare: route.distanceFare,
      timeFare: route.timeFare,
      surge: route.surge,
      currency: "INR",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getRouteMarketIntel = async (req, res) => {
  try {
    const { pickup, drop, pickupLat, pickupLng, dropLat, dropLng, passengerId } =
      req.body;

    const openRides = await Ride.find({
      status: { $in: OPEN_RIDE_STATUSES },
    })
      .sort({ createdAt: -1 })
      .limit(30);

    const matches = openRides.filter((ride) => {
      if (passengerId && String(ride.passengerId) === String(passengerId)) {
        return false;
      }

      return matchesRoute(
        ride,
        pickup,
        drop,
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
      );
    });

    return res.status(200).json({
      similarPassengers: matches.length,
      routeDemandScore: Math.min(100, matches.length * 18),
      openRequests: matches.slice(0, 6).map((ride) => ({
        rideId: String(ride._id),
        pickup: ride.pickup,
        drop: ride.drop,
        estimatedFare: ride.estimatedFare,
        requestedRideType: ride.requestedRideType,
        bidCount: ride.bids?.length || 0,
        status: ride.status,
        createdAt: ride.createdAt,
      })),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const listNearbyDrivers = async (req, res) => {
  try {
    const { pickupLat, pickupLng } = req.query;

    let availableDrivers = MOCK_DRIVERS;

    if (pickupLat && pickupLng) {
      const lat1 = parseFloat(pickupLat);
      const lng1 = parseFloat(pickupLng);
      const SEARCH_RADIUS_KM = 50;

      availableDrivers = MOCK_DRIVERS.filter((driver) => {
        const distanceKm = haversineDistanceKm(driver.lat, driver.lng, lat1, lng1);
        return distanceKm !== null && distanceKm <= SEARCH_RADIUS_KM;
      });
    }

    return res.status(200).json({ drivers: availableDrivers });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const createMarketplaceRideRequest = async (req, res) => {
  try {
    const {
      passengerId,
      pickup,
      drop,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      estimatedFare,
      paymentMethod,
      requestedRideType,
      distanceKm,
      estimatedDurationMinutes,
    } = req.body;

    if (!passengerId || !pickup || !drop || !estimatedFare) {
      return res.status(400).json({
        message: "passengerId, pickup, drop, and estimatedFare are required",
      });
    }

    const activeRide = await Ride.findOne({
      passengerId,
      status: { $in: ["bidding", "searching", "accepted", "on_trip"] },
    }).sort({ createdAt: -1 });

    if (activeRide) {
      return res.status(200).json({
        message: "Using existing active request",
        ride: serializeRideMarket(activeRide),
      });
    }

    const routeDemandScore = Math.min(
      100,
      Math.max(0, Math.round((distanceKm || 0) * 2)),
    );

    const passenger = await User.findById(passengerId).select("name phone rating");
    if (!passenger) {
      return res.status(404).json({ message: "Passenger not found" });
    }

    const ride = await Ride.create({
      passengerId,
      pickup,
      drop,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      estimatedFare,
      paymentMethod: paymentMethod || "mock",
      requestedRideType: requestedRideType || "mini",
      status: "bidding",
      routeMetrics: {
        distanceKm: distanceKm || null,
        estimatedDurationMinutes: estimatedDurationMinutes || null,
        routeDemandScore,
      },
      passengerDetails: {
        name: passenger.name,
        rating: passenger.rating || 5,
        phone: passenger.phone || "+91 9000000000",
      },
      timeline: [{ status: "bidding", at: new Date() }],
    });

    const passengerName = passenger?.name || "Passenger";

    const io = getIO();
    if (io) {
      io.to("drivers-room").emit("incoming-ride", {
        rideId: ride._id.toString(),
        passengerId: String(passengerId),
        passengerName,
        passengerPhone: passenger?.phone || "+91 9000000000",
        pickup,
        pickupLat: pickupLat || 28.6139,
        pickupLng: pickupLng || 77.209,
        drop,
        estimatedFare,
        requestedRideType: requestedRideType || "mini",
        distance: distanceKm ? `${distanceKm.toFixed(1)} km` : "~5 km",
        eta: estimatedDurationMinutes
          ? formatDurationLabel(estimatedDurationMinutes)
          : "~12 min",
        bidCount: 0,
        status: "bidding",
        createdAt: ride.createdAt,
      });
    }

    return res.status(201).json({
      message: "Ride request opened for bids",
      ride: serializeRideMarket(ride),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getRideMarketplace = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    return res.status(200).json({ ride: serializeRideMarket(ride) });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getPassengerActiveRide = async (req, res) => {
  try {
    const { passengerId } = req.params;

    if (!passengerId) {
      return res.status(400).json({ message: "passengerId is required" });
    }

    const ride = await Ride.findOne({
      passengerId,
      status: { $in: PASSENGER_RESUMABLE_STATUSES },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      ride: ride ? serializeRideMarket(ride) : null,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const placeDriverBid = async (req, res) => {
  try {
    const { rideId, driverId, amount, etaMinutes, note } = req.body;

    if (!rideId || !driverId || !amount) {
      return res
        .status(400)
        .json({ message: "rideId, driverId, and amount are required" });
    }

    const [ride, driver] = await Promise.all([
      Ride.findById(rideId),
      User.findById(driverId),
    ]);

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (!OPEN_RIDE_STATUSES.includes(ride.status)) {
      return res.status(400).json({ message: "Ride is no longer open for bids" });
    }

    const numericAmount = Math.max(1, Number(amount));
    const numericEta = Math.max(2, Number(etaMinutes) || 8);

    const existingBid = ride.bids.find(
      (bid) => String(bid.driverId) === String(driverId),
    );

    if (existingBid) {
      existingBid.amount = numericAmount;
      existingBid.etaMinutes = numericEta;
      existingBid.note = String(note || "").trim();
      existingBid.driverName = driver.name;
      existingBid.driverPhone = driver.phone || "+91 9000000000";
      existingBid.vehicle = driver.vehicle || "Vehicle details pending";
      existingBid.rating = driver.rating || 4.5;
      existingBid.status = "pending";
      existingBid.createdAt = new Date();
    } else {
      ride.bids.push({
        driverId,
        driverName: driver.name,
        driverPhone: driver.phone || "+91 9000000000",
        vehicle: driver.vehicle || "Vehicle details pending",
        rating: driver.rating || 4.5,
        amount: numericAmount,
        etaMinutes: numericEta,
        note: String(note || "").trim(),
        status: "pending",
      });
    }

    await ride.save();

    const bid =
      ride.bids.find((item) => String(item.driverId) === String(driverId)) ||
      ride.bids[ride.bids.length - 1];

    emitRideBidUpdate(ride, bid, { source: "driver-bid" });
    emitRideMarketUpdate(ride, { source: "driver-bid" });

    return res.status(200).json({
      message: "Bid submitted successfully",
      bid: serializeBid(bid),
      ride: serializeRideMarket(ride),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const selectDriverBid = async (req, res) => {
  try {
    const { rideId, driverId } = req.body;

    if (!rideId || !driverId) {
      return res.status(400).json({ message: "rideId and driverId are required" });
    }

    const [ride, driver] = await Promise.all([
      Ride.findById(rideId),
      User.findById(driverId),
    ]);

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const selectedBid = ride.bids.find(
      (bid) => String(bid.driverId) === String(driverId),
    );

    if (!selectedBid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    ride.status = "accepted";
    ride.driverId = driverId;
    ride.selectedBidDriverId = driverId;
    ride.actualFare = selectedBid.amount;
    ride.assignedDriver = {
      id: String(driver._id),
      name: driver.name,
      phone: driver.phone || "+91 9000000000",
      vehicle: driver.vehicle || "Vehicle details pending",
      vehicleNumber: driver.vehicleNumber || "Plate pending",
      rating: driver.rating || 4.5,
      lat: driver.lat,
      lng: driver.lng,
    };
    ride.bids.forEach((bid) => {
      bid.status =
        String(bid.driverId) === String(driverId) ? "selected" : "declined";
    });
    ride.timeline.push({
      status: "accepted",
      at: new Date(),
    });

    await ride.save();

    const io = getIO();
    if (io) {
      io.to(String(ride._id)).emit("driver-accepted", {
        rideId: String(ride._id),
        driverId: String(driver._id),
        driverName: driver.name,
        driverPhone: driver.phone || "+91 9000000000",
        vehicle: driver.vehicle || "Vehicle details pending",
        vehicleNumber: driver.vehicleNumber || "Plate pending",
        rating: driver.rating || 4.5,
        fare: selectedBid.amount,
        etaMinutes: selectedBid.etaMinutes,
        timestamp: new Date().toISOString(),
      });

      io.to(`driver-${String(driver._id)}`).emit("ride-bid-selected", {
        rideId: String(ride._id),
        bid: serializeBid(selectedBid),
      });
    }

    emitRideMarketUpdate(ride, { source: "passenger-selected-bid" });

    return res.status(200).json({
      message: "Driver selected successfully",
      ride: serializeRideMarket(ride),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const sendRideMessage = async (req, res) => {
  try {
    const { rideId, senderType, senderId, text } = req.body;

    if (!rideId || !senderType || !senderId || !text) {
      return res.status(400).json({
        message: "rideId, senderType, senderId, and text are required",
      });
    }

    const [ride, sender] = await Promise.all([
      Ride.findById(rideId),
      User.findById(senderId).select("name"),
    ]);

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const message = {
      senderType,
      senderId,
      senderName: sender?.name || "RideScout User",
      text: String(text).trim(),
    };

    if (!message.text) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    ride.messages.push(message);
    await ride.save();

    const savedMessage = ride.messages[ride.messages.length - 1];
    emitRideMessage(rideId, savedMessage);

    return res.status(201).json({
      message: "Message sent",
      chatMessage: serializeMessage(savedMessage),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const bookRide = async (req, res) => {
  try {
    const {
      passengerId,
      pickup,
      drop,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      estimatedFare,
      paymentMethod,
      requestedRideType,
    } = req.body;

    if (!passengerId || !pickup || !drop || !estimatedFare) {
      return res.status(400).json({
        message: "passengerId, pickup, drop, and estimatedFare are required",
      });
    }

    const existingRide = await Ride.findOne({
      passengerId,
      status: { $in: PASSENGER_ACTIVE_STATUSES },
    }).sort({ createdAt: -1 });

    if (existingRide) {
      return res.status(200).json({
        message: "Passenger already has an active ride",
        ride: serializeRideMarket(existingRide),
      });
    }

    const route = calculateRoute(pickupLat, pickupLng, dropLat, dropLng);
    const passenger = await User.findById(passengerId).select("name phone rating");
    if (!passenger) {
      return res.status(404).json({ message: "Passenger not found" });
    }

    const ride = await Ride.create({
      passengerId,
      pickup,
      drop,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      estimatedFare,
      paymentMethod: paymentMethod || "mock",
      requestedRideType: requestedRideType || "mini",
      status: "searching",
      routeMetrics: {
        distanceKm: route.distanceKm,
        estimatedDurationMinutes: route.estimatedDurationMinutes,
        routeDemandScore: 0,
      },
      passengerDetails: {
        name: passenger.name,
        rating: passenger.rating || 5,
        phone: passenger.phone || "+91 9000000000",
      },
      bids: [],
      messages: [],
      timeline: [{ status: "searching", at: new Date() }],
    });

    const passengerName = passenger?.name || "Passenger";

    const io = getIO();
    if (io) {
      io.to("drivers-room").emit("incoming-ride", {
        rideId: ride._id.toString(),
        passengerId: passengerId,
        passengerName,
        passengerPhone: passenger?.phone || "+91 9000000000",
        pickup,
        pickupLat: pickupLat || 28.6139,
        pickupLng: pickupLng || 77.209,
        drop,
        estimatedFare,
        requestedRideType: requestedRideType || "mini",
        distance: `${route.distanceKm.toFixed(1)} km`,
        eta: formatDurationLabel(route.estimatedDurationMinutes),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(201).json({
      message: "Ride booked",
      ride: serializeRideMarket(ride),
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

    return res.status(200).json({ rides: rides.map(serializeRideRecord) });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const rateCompletedRide = async (req, res) => {
  try {
    const { rideId, passengerId, score, feedback } = req.body;

    if (!rideId || !passengerId || !score) {
      return res.status(400).json({
        message: "rideId, passengerId, and score are required",
      });
    }

    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 1 || numericScore > 5) {
      return res.status(400).json({ message: "score must be between 1 and 5" });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (String(ride.passengerId) !== String(passengerId)) {
      return res.status(403).json({ message: "Passenger does not match this ride" });
    }

    if (ride.status !== "completed") {
      return res.status(400).json({ message: "Ride must be completed before rating" });
    }

    ride.passengerRating = {
      score: numericScore,
      feedback: String(feedback || "").trim(),
      submittedAt: new Date(),
    };

    await ride.save();

    return res.status(200).json({
      message: "Ride rated successfully",
      ride: serializeRideMarket(ride),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  estimateFare,
  getRouteMarketIntel,
  listNearbyDrivers,
  createMarketplaceRideRequest,
  getRideMarketplace,
  placeDriverBid,
  selectDriverBid,
  sendRideMessage,
  bookRide,
  getRideHistory,
  getPassengerActiveRide,
  rateCompletedRide,
};
