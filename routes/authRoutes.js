const express = require("express");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const User = require("../models/user");
const { setSession, clearSession, requireAuth } = require("../middleware/auth");

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const clean = (value) => typeof value === "string" ? value.trim() : "";
const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
};
const verifyPassword = async (password, encoded) => {
  const [salt, hashHex] = (encoded || "").split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};
const publicUser = (user) => ({ userId: user._id, username: user.username, email: user.email, rollNumber: user.rollNumber, department: user.department, role: "student" });
const tokenConfigured = () => Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);

router.post("/register", async (req, res) => {
  try {
    const { username, email, rollNumber, department } = req.body || {};
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const values = { username: clean(username), email: clean(email).toLowerCase(), rollNumber: clean(rollNumber), department: clean(department) || "Not specified" };
    if (!values.username || !values.email || !values.rollNumber || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return res.status(400).json({ success: false, message: "Enter a name, valid email, and register number" });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters" });
    const existing = await User.findOne({ $or: [{ email: values.email }, { rollNumber: values.rollNumber }] });
    if (existing) {
      if (existing.email === values.email) {
        return res.status(409).json({
          success: false,
          code: "EMAIL_EXISTS",
          message: "An account with this email already exists. Sign in with it instead.",
        });
      }
      return res.status(409).json({
        success: false,
        code: "ROLL_NUMBER_EXISTS",
        message: "This register number is already linked to an account.",
      });
    }
    await User.create({ ...values, passwordHash: await hashPassword(password) });
    return res.status(201).json({ success: true, message: "Account created. Please log in." });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateFields = Object.keys(error.keyPattern || error.keyValue || {});
      const emailConflict = duplicateFields.includes("email") &&
        (!error.keyValue?.email || error.keyValue.email === clean(req.body?.email).toLowerCase());
      const rollNumberConflict = duplicateFields.includes("rollNumber") &&
        (!error.keyValue?.rollNumber || error.keyValue.rollNumber === clean(req.body?.rollNumber));

      if (emailConflict) {
        return res.status(409).json({
          success: false,
          code: "EMAIL_EXISTS",
          message: "An account with this email already exists. Sign in with it instead.",
        });
      }
      if (rollNumberConflict) {
        return res.status(409).json({
          success: false,
          code: "ROLL_NUMBER_EXISTS",
          message: "This register number is already linked to an account.",
        });
      }

      console.error("Registration hit an unexpected unique database index:", {
        index: error.index,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue,
      });
      return res.status(500).json({
        success: false,
        message: "Registration is blocked by a database constraint. Check the server logs.",
      });
    }
    console.error("Registration error:", error);
    return res.status(500).json({ success: false, message: "Registration failed due to a server error" });
  }
});

router.post("/login", async (req, res) => {
  const email = clean(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });
  if (!tokenConfigured()) return res.status(503).json({ success: false, message: "Authentication is not configured. Set AUTH_SECRET to a random value of at least 32 characters." });
  try {
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ success: false, message: "Invalid email or password" });
    setSession(res, { _id: user._id, role: "student" });
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Login failed due to a server error" });
  }
});

router.post("/warden/login", async (req, res) => {
  const username = clean(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const assignedUser = process.env.WARDEN_USERNAME || "";
  const assignedPassword = process.env.WARDEN_PASSWORD || "";
  if (!username || !password) return res.status(400).json({ success: false, message: "Username and password are required" });
  if (!tokenConfigured() || !assignedUser || !assignedPassword) return res.status(503).json({ success: false, message: "Warden authentication is not configured on the server" });
  const safeEqual = (a, b) => { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); };
  if (!safeEqual(username, assignedUser) || !safeEqual(password, assignedPassword)) return res.status(401).json({ success: false, message: "Invalid warden credentials" });
  setSession(res, { _id: "warden", role: "warden" });
  return res.json({ success: true, user: { username: "Warden", role: "warden" } });
});

router.post("/logout", (req, res) => { clearSession(res); res.json({ success: true }); });
router.get("/me", requireAuth(), async (req, res) => {
  if (req.auth.role === "warden") return res.json({ success: true, user: { username: "Warden", role: "warden" } });
  const user = await User.findById(req.auth.sub);
  if (!user) return res.status(401).json({ success: false, message: "Account no longer exists" });
  return res.json({ success: true, user: publicUser(user) });
});

module.exports = router;
