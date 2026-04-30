const express = require("express");

const {
  createOrder,
  renderCheckoutPage,
  verifyPayment,
  markPaymentFailure,
} = require("../controllers/paymentController");
const { authenticateUser } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/orders", authenticateUser, createOrder);
router.get("/checkout", renderCheckoutPage);
router.post("/verify", verifyPayment);
router.post("/failure", authenticateUser, markPaymentFailure);

module.exports = router;
