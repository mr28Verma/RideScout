const User = require("../models/User");
const crypto = require("crypto");

const RIDE_TYPES = new Set(["bike", "mini", "sedan", "suv"]);
const PAYMENT_TYPES = new Set(["mock", "stripe", "razorpay"]);

const cleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const sanitizeSavedPlaces = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const label = cleanString(item?.label);
      const address = cleanString(item?.address);

      if (!label || !address) return null;

      return {
        id: cleanString(item?.id) || `place-${Date.now()}-${index}`,
        label,
        address,
        lat: normalizeNumber(item?.lat),
        lng: normalizeNumber(item?.lng),
      };
    })
    .filter(Boolean);
};

const sanitizePaymentMethods = (items) => {
  if (!Array.isArray(items)) return [];

  let defaultAssigned = false;
  const normalized = items
    .map((item, index) => {
      const label = cleanString(item?.label);
      const type = cleanString(item?.type);
      const digits = cleanString(item?.last4).replace(/\D/g, "").slice(-4);

      if (!label || !PAYMENT_TYPES.has(type) || digits.length !== 4) {
        return null;
      }

      const isDefault = Boolean(item?.isDefault) && !defaultAssigned;
      if (isDefault) defaultAssigned = true;

      return {
        id: cleanString(item?.id) || `payment-${Date.now()}-${index}`,
        label,
        type,
        last4: digits,
        isDefault,
      };
    })
    .filter(Boolean);

  if (normalized.length > 0 && !normalized.some((item) => item.isDefault)) {
    normalized[0].isDefault = true;
  }

  return normalized;
};

const sanitizeEmergencyContacts = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const name = cleanString(item?.name);
      const phone = cleanString(item?.phone);
      const relationship = cleanString(item?.relationship);

      if (!name || !phone || !relationship) return null;

      return {
        id: cleanString(item?.id) || `contact-${Date.now()}-${index}`,
        name,
        phone,
        relationship,
      };
    })
    .filter(Boolean);
};

const serializeUserProfile = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  preferredRideType: user.preferredRideType,
  savedPlaces: user.savedPlaces || [],
  paymentMethods: user.paymentMethods || [],
  emergencyContacts: user.emergencyContacts || [],
  isOnline: user.isOnline,
  vehicle: user.vehicle,
  vehicleNumber: user.vehicleNumber,
  currentLocation: user.currentLocation,
  rating: user.rating,
  totalEarnings: user.totalEarnings,
  totalRides: user.totalRides,
  acceptanceRate: user.acceptanceRate,
  lat: user.lat,
  lng: user.lng,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const HASH_PREFIX = "scrypt";

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${HASH_PREFIX}:${salt}:${hash}`;
};

const verifyPassword = (password, storedPassword) => {
  if (!storedPassword) return false;

  if (!storedPassword.startsWith(`${HASH_PREFIX}:`)) {
    return storedPassword === password;
  }

  const [, salt, hash] = storedPassword.split(":");
  if (!salt || !hash) return false;

  const candidateHash = crypto.scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(hash, "hex");

  if (candidateHash.length !== storedHashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateHash, storedHashBuffer);
};

const buildAuthPayload = (user) => ({
  message: "Authentication successful",
  token: user.sessionToken,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  },
});

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashPassword(password),
      role: null,
      sessionToken: crypto.randomBytes(24).toString("hex"),
      lastLoginAt: new Date(),
    });

    return res.status(201).json({
      ...buildAuthPayload(user),
      message: "Signup successful",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.password.startsWith(`${HASH_PREFIX}:`)) {
      user.password = hashPassword(password);
    }

    user.sessionToken = crypto.randomBytes(24).toString("hex");
    user.lastLoginAt = new Date();
    await user.save();

    return res.status(200).json({
      ...buildAuthPayload(user),
      message: "Login successful",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const setRole = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ message: "userId and role are required" });
    }

    if (!["passenger", "driver"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Role updated successfully",
      token: user.sessionToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(serializeUserProfile(user));
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Allowed fields for update
    const allowedFields = [
      "name",
      "phone",
      "vehicle",
      "vehicleNumber",
      "lat",
      "lng",
      "currentLocation",
      "preferredRideType",
      "savedPlaces",
      "paymentMethods",
      "emergencyContacts",
    ];
    const filteredUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    if ("name" in filteredUpdates) {
      filteredUpdates.name = cleanString(filteredUpdates.name);
    }

    if ("phone" in filteredUpdates) {
      filteredUpdates.phone = cleanString(filteredUpdates.phone);
    }

    if ("preferredRideType" in filteredUpdates) {
      const preferredRideType = cleanString(filteredUpdates.preferredRideType);
      if (!RIDE_TYPES.has(preferredRideType)) {
        delete filteredUpdates.preferredRideType;
      } else {
        filteredUpdates.preferredRideType = preferredRideType;
      }
    }

    if ("savedPlaces" in filteredUpdates) {
      filteredUpdates.savedPlaces = sanitizeSavedPlaces(filteredUpdates.savedPlaces);
    }

    if ("paymentMethods" in filteredUpdates) {
      filteredUpdates.paymentMethods = sanitizePaymentMethods(
        filteredUpdates.paymentMethods,
      );
    }

    if ("emergencyContacts" in filteredUpdates) {
      filteredUpdates.emergencyContacts = sanitizeEmergencyContacts(
        filteredUpdates.emergencyContacts,
      );
    }

    const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      ...serializeUserProfile(user),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    await User.findByIdAndUpdate(userId, {
      sessionToken: null,
      isOnline: false,
    });

    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  signup,
  login,
  setRole,
  getProfile,
  updateProfile,
  logout,
};
