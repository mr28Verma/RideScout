const express = require("express");
const {
  signup,
  login,
  refreshToken,
  setRole,
  getProfile,
  updateProfile,
  logout,
} = require("../controllers/authController");
const { authenticateUser } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.patch("/role", authenticateUser, setRole);
router.get("/profile/:userId", authenticateUser, getProfile);
router.patch("/profile/:userId", authenticateUser, updateProfile);
router.post("/logout", authenticateUser, logout);

module.exports = router;
