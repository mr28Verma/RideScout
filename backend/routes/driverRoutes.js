const express = require("express");
const {
  authenticateUser,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const {
  toggleOnlineStatus,
  getPendingRides,
  acceptRide,
  rejectRide,
  updateDriverLocation,
  getEarnings,
  getDriverRideHistory,
  getActiveTrips,
  updateRideStatus,
} = require("../controllers/driverController");

const router = express.Router();
router.use(authenticateUser, authorizeRoles("driver"));

// Driver status
router.post("/toggle-online", toggleOnlineStatus);

// Ride management
router.get("/pending-rides/:driverId", getPendingRides);
router.post("/accept-ride", acceptRide);
router.post("/reject-ride", rejectRide);
router.post("/update-status", updateRideStatus);

// Location & tracking
router.post("/location", updateDriverLocation);
router.get("/active-trips/:driverId", getActiveTrips);

// Earnings & history
router.get("/earnings/:driverId", getEarnings);
router.get("/ride-history/:driverId", getDriverRideHistory);

module.exports = router;
