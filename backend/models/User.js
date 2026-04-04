const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["passenger", "driver"],
      default: null,
    },
    // Driver-specific fields
    isOnline: {
      type: Boolean,
      default: false,
    },
    vehicle: {
      type: String,
      default: null,
    },
    vehicleNumber: {
      type: String,
      default: null,
    },
    rating: {
      type: Number,
      default: 4.5,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    totalRides: {
      type: Number,
      default: 0,
    },
    acceptanceRate: {
      type: Number,
      default: 100,
    },
    lat: {
      type: Number,
      default: 28.6139,
    },
    lng: {
      type: Number,
      default: 77.209,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
