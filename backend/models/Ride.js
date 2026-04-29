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
    pickupLat: {
      type: Number,
      default: null,
    },
    pickupLng: {
      type: Number,
      default: null,
    },
    dropLat: {
      type: Number,
      default: null,
    },
    dropLng: {
      type: Number,
      default: null,
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
    requestedRideType: {
      type: String,
      enum: ["bike", "mini", "sedan", "suv"],
      default: "mini",
    },
    status: {
      type: String,
      enum: [
        "bidding",
        "searching",
        "accepted",
        "arriving",
        "on_trip",
        "completed",
        "rejected",
      ],
      default: "bidding",
    },
    routeMetrics: {
      distanceKm: {
        type: Number,
        default: null,
      },
      estimatedDurationMinutes: {
        type: Number,
        default: null,
      },
      routeDemandScore: {
        type: Number,
        default: 0,
      },
    },
    bids: [
      {
        driverId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        driverName: String,
        driverPhone: String,
        vehicle: String,
        rating: Number,
        amount: Number,
        etaMinutes: Number,
        note: String,
        status: {
          type: String,
          enum: ["pending", "selected", "declined"],
          default: "pending",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    selectedBidDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    messages: [
      {
        senderType: {
          type: String,
          enum: ["passenger", "driver"],
          required: true,
        },
        senderId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        senderName: {
          type: String,
          required: true,
        },
        text: {
          type: String,
          required: true,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    assignedDriver: {
      id: String,
      name: String,
      phone: String,
      vehicle: String,
      vehicleNumber: String,
      rating: Number,
      lat: Number,
      lng: Number,
    },
    passengerRating: {
      score: {
        type: Number,
        default: null,
      },
      feedback: {
        type: String,
        default: "",
        trim: true,
      },
      submittedAt: {
        type: Date,
        default: null,
      },
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
