const express = require("express");
const router = express.Router();
const { signup, login, getMe, resetPassword } = require("../controllers/authController");
const protect = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/reset-password", authLimiter, resetPassword);
router.get("/me", protect, getMe);

module.exports = router;