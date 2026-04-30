const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_SECRET || "ridescout-access-secret";

const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
      name: payload.name,
    };
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token expired" });
    }

    return res.status(401).json({ message: "Invalid access token" });
  }
};

const authorizeRoles =
  (...roles) =>
  (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };

module.exports = {
  authenticateUser,
  authorizeRoles,
};
