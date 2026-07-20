const express = require("express");
const router = express.Router();
const { registerKey } = require("../controllers/keysController");
const protect = require("../middleware/auth");

router.post("/register", protect, registerKey);

module.exports = router;