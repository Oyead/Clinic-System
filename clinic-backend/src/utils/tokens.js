const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

const ACCESS_EXPIRES_IN = process.env.ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || "7d";
const REFRESH_EXPIRES_IN_MS = parseRefreshMs(process.env.REFRESH_EXPIRES_IN) || 7 * 24 * 60 * 60 * 1000;

function parseRefreshMs(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d+)(m|h|d)$/);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2];
  const mult = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[unit];
  return n * mult;
}

const signAccessToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, type: "access" },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { id: user.id, type: "refresh" },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN, jwtid: crypto.randomBytes(8).toString("hex") }
  );

const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET);

module.exports = {
  ACCESS_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
  REFRESH_EXPIRES_IN_MS,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
