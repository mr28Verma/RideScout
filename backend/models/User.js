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
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    sessionToken: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["passenger", "driver"],
      default: null,
    },
    preferredRideType: {
      type: String,
      enum: ["bike", "mini", "sedan", "suv"],
      default: "mini",
    },
    savedPlaces: [
      {
        id: {
          type: String,
          required: true,
        },
        label: {
          type: String,
          required: true,
          trim: true,
        },
        address: {
          type: String,
          required: true,
          trim: true,
        },
        lat: {
          type: Number,
          default: null,
        },
        lng: {
          type: Number,
          default: null,
        },
      },
    ],
    paymentMethods: [
      {
        id: {
          type: String,
          required: true,
        },
        label: {
          type: String,
          required: true,
          trim: true,
        },
        type: {
          type: String,
          enum: ["mock", "stripe", "razorpay"],
          default: "mock",
        },
        last4: {
          type: String,
          required: true,
          trim: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    emergencyContacts: [
      {
        id: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        phone: {
          type: String,
          required: true,
          trim: true,
        },
        relationship: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
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
    currentLocation: {
      type: String,
      default: null,
      trim: true,
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
