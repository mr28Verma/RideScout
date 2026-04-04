const express = require("express");
const {
  estimateFare,
  listNearbyDrivers,
  bookRide,
  getRideHistory,
} = require("../controllers/rideController");

const router = express.Router();

router.post("/estimate-fare", estimateFare);
router.get("/nearby-drivers", listNearbyDrivers);
router.post("/book", bookRide);
router.get("/history/:passengerId", getRideHistory);

module.exports = router;
