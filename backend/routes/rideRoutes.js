const express = require("express");
const {
  authenticateUser,
  authorizeRoles,
} = require("../middleware/authMiddleware");
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

router.use(authenticateUser);

router.post("/estimate-fare", authorizeRoles("passenger"), estimateFare);
router.post("/route-market-intel", authorizeRoles("passenger"), getRouteMarketIntel);
router.get("/nearby-drivers", listNearbyDrivers);
router.post("/marketplace-request", authorizeRoles("passenger"), createMarketplaceRideRequest);
router.get("/marketplace/:rideId", getRideMarketplace);
router.post("/marketplace/bid", authorizeRoles("driver"), placeDriverBid);
router.post("/marketplace/select-bid", authorizeRoles("passenger"), selectDriverBid);
router.post("/marketplace/message", sendRideMessage);
router.post("/book", authorizeRoles("passenger"), bookRide);
router.post("/rate", authorizeRoles("passenger"), rateCompletedRide);
router.get("/active/:passengerId", authorizeRoles("passenger"), getPassengerActiveRide);
router.get("/history/:passengerId", authorizeRoles("passenger"), getRideHistory);

module.exports = router;
