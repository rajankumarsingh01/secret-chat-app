const express = require("express");
const router = express.Router();
const {
  getMessages,
  getGroupMessages,
  getContacts,
  sendMessage,
  uploadChatImage,
  uploadVoiceMessage,
  openViewOnceMessage,
  getConversations,
  deleteMessage,
} = require("../controllers/chatController");
const protect = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadAudio } = require("../middleware/upload");
const { uploadLimiter } = require("../middleware/rateLimiter");

router.get("/conversations", protect, getConversations);
router.get("/contacts", protect, getContacts);
router.get("/group/:conversationId/messages", protect, getGroupMessages);
router.get("/:otherUserId", protect, getMessages);
router.post("/", protect, sendMessage);
router.post("/upload-image", protect, uploadLimiter, upload.single("image"), uploadChatImage);
router.post("/upload-voice", protect, uploadLimiter, uploadAudio.single("audio"), uploadVoiceMessage);
router.post("/:messageId/view-once", protect, openViewOnceMessage);
router.delete("/:messageId", protect, deleteMessage);

module.exports = router;