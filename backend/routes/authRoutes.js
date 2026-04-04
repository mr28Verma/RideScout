const express = require("express");
const {
  signup,
  login,
  setRole,
  getProfile,
  updateProfile,
  logout,
} = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.patch("/role", setRole);
router.get("/profile/:userId", getProfile);
router.patch("/profile/:userId", updateProfile);
router.post("/logout", logout);

module.exports = router;
