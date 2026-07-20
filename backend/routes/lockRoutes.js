const express = require("express");
const router = express.Router();
const {
  requestLock,
  confirmLock,
  rejectLock,
  requestUnlock,
  confirmUnlock,
  rejectUnlock,
  getLockStatus,
} = require("../controllers/lockController");
const protect = require("../middleware/auth");

router.get("/:conversationId/status", protect, getLockStatus);
router.post("/:conversationId/request-lock", protect, requestLock);
router.post("/:conversationId/confirm-lock", protect, confirmLock);
router.post("/:conversationId/reject-lock", protect, rejectLock);
router.post("/:conversationId/request-unlock", protect, requestUnlock);
router.post("/:conversationId/confirm-unlock", protect, confirmUnlock);
router.post("/:conversationId/reject-unlock", protect, rejectUnlock);

module.exports = router;