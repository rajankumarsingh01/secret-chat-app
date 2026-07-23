const express = require("express");
const router = express.Router();
const {
  createGroup,
  getGroupInfo,
  renameGroup,
  addMembers,
  removeMember,
  leaveGroup,
} = require("../controllers/groupController");
const protect = require("../middleware/auth");

router.post("/", protect, createGroup);
router.get("/:conversationId", protect, getGroupInfo);
router.patch("/:conversationId/rename", protect, renameGroup);
router.post("/:conversationId/members", protect, addMembers);
router.delete("/:conversationId/members/:memberId", protect, removeMember);
router.post("/:conversationId/leave", protect, leaveGroup);

module.exports = router;