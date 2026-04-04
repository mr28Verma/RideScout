const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    pickup: {
      type: String,
      required: true,
      trim: true,
    },
    drop: {
      type: String,
      required: true,
      trim: true,
    },
    estimatedFare: {
      type: Number,
      required: true,
    },
    actualFare: {
      type: Number,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["mock", "stripe", "razorpay"],
      default: "mock",
    },
    status: {
      type: String,
      enum: ["searching", "accepted", "on_trip", "completed", "rejected"],
      default: "searching",
    },
    assignedDriver: {
      id: String,
      name: String,
      vehicle: String,
      rating: Number,
      lat: Number,
      lng: Number,
    },
    passengerDetails: {
      name: String,
      rating: Number,
      phone: String,
    },
    timeline: [
      {
        status: String,
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Ride", rideSchema);
