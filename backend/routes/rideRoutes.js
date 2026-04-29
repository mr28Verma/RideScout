const express = require("express");
const {
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
} = require("../controllers/rideController");

const router = express.Router();

router.post("/estimate-fare", estimateFare);
router.post("/route-market-intel", getRouteMarketIntel);
router.get("/nearby-drivers", listNearbyDrivers);
router.post("/marketplace-request", createMarketplaceRideRequest);
router.get("/marketplace/:rideId", getRideMarketplace);
router.post("/marketplace/bid", placeDriverBid);
router.post("/marketplace/select-bid", selectDriverBid);
router.post("/marketplace/message", sendRideMessage);
router.post("/book", bookRide);
router.post("/rate", rateCompletedRide);
router.get("/active/:passengerId", getPassengerActiveRide);
router.get("/history/:passengerId", getRideHistory);

module.exports = router;
