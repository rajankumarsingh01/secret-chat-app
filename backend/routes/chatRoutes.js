const express = require("express");
const router = express.Router();
const {
  getMessages,
  sendMessage,
  uploadChatImage,
  getConversations,
  deleteMessage,
} = require("../controllers/chatController");
const protect = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadLimiter } = require("../middleware/rateLimiter");

router.get("/conversations", protect, getConversations);
router.get("/:otherUserId", protect, getMessages);
router.post("/", protect, sendMessage);
router.post("/upload-image", protect, uploadLimiter, upload.single("image"), uploadChatImage);
router.delete("/:messageId", protect, deleteMessage);

module.exports = router;