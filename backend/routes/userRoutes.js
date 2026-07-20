const express = require("express");
const router = express.Router();
const { uploadProfilePic, savePushToken } = require("../controllers/userController");
const protect = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadLimiter } = require("../middleware/rateLimiter");

router.post("/profile-pic", protect, uploadLimiter, upload.single("image"), uploadProfilePic);
router.post("/push-token", protect, savePushToken);

module.exports = router;