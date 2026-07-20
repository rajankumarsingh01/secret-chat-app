const express = require("express");
const router = express.Router();
const { generateCode, connect } = require("../controllers/pairingController");
const protect = require("../middleware/auth");
const { pairingConnectLimiter } = require("../middleware/rateLimiter");

router.post("/generate", protect, generateCode);
router.post("/connect", protect, pairingConnectLimiter, connect);

module.exports = router;