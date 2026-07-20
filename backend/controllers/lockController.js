const Conversation = require("../models/Conversation");
const User = require("../models/User");

const getConversationForUser = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return null;
  const isParticipant = conversation.participants.some((p) => p.toString() === userId.toString());
  if (!isParticipant) return null;
  return conversation;
};

const getOtherParticipant = (conversation, userId) =>
  conversation.participants.find((p) => p.toString() !== userId.toString());

// @desc Request to lock exclusively with the partner in this conversation
const requestLock = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    if (conversation.locked) {
      return res.status(400).json({ message: "This conversation is already locked" });
    }
    if (req.user.lockedWith) {
      return res.status(400).json({ message: "You're already locked with someone else" });
    }

    conversation.lockRequestedBy = req.user._id;
    conversation.lockConfirmedBy = [req.user._id];
    await conversation.save();

    res.status(200).json({ message: "Lock requested", conversation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc The partner confirms the lock request — locks once both have confirmed
const confirmLock = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    if (!conversation.lockRequestedBy) {
      return res.status(400).json({ message: "No pending lock request" });
    }
    if (conversation.lockConfirmedBy.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: "You already confirmed this request" });
    }

    conversation.lockConfirmedBy.push(req.user._id);

    let locked = false;
    if (conversation.lockConfirmedBy.length >= 2) {
      conversation.locked = true;
      conversation.lockRequestedBy = null;
      conversation.lockConfirmedBy = [];
      locked = true;

      const otherId = getOtherParticipant(conversation, req.user._id);
      await User.findByIdAndUpdate(req.user._id, { lockedWith: otherId });
      await User.findByIdAndUpdate(otherId, { lockedWith: req.user._id });
    }

    await conversation.save();
    res.status(200).json({ message: locked ? "Locked successfully" : "Confirmation recorded", locked, conversation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Reject/cancel a pending lock request
const rejectLock = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    conversation.lockRequestedBy = null;
    conversation.lockConfirmedBy = [];
    await conversation.save();

    res.status(200).json({ message: "Lock request cancelled" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Request to unlock this conversation
const requestUnlock = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    if (!conversation.locked) {
      return res.status(400).json({ message: "This conversation is not locked" });
    }

    conversation.unlockRequestedBy = req.user._id;
    conversation.unlockConfirmedBy = [req.user._id];
    await conversation.save();

    res.status(200).json({ message: "Unlock requested", conversation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc The partner confirms the unlock request — unlocks once both have confirmed
const confirmUnlock = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    if (!conversation.unlockRequestedBy) {
      return res.status(400).json({ message: "No pending unlock request" });
    }
    if (conversation.unlockConfirmedBy.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: "You already confirmed this request" });
    }

    conversation.unlockConfirmedBy.push(req.user._id);

    let unlocked = false;
    if (conversation.unlockConfirmedBy.length >= 2) {
      conversation.locked = false;
      conversation.unlockRequestedBy = null;
      conversation.unlockConfirmedBy = [];
      unlocked = true;

      const otherId = getOtherParticipant(conversation, req.user._id);
      await User.findByIdAndUpdate(req.user._id, { lockedWith: null });
      await User.findByIdAndUpdate(otherId, { lockedWith: null });
    }

    await conversation.save();
    res.status(200).json({ message: unlocked ? "Unlocked successfully" : "Confirmation recorded", unlocked, conversation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Reject/cancel a pending unlock request
const rejectUnlock = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    conversation.unlockRequestedBy = null;
    conversation.unlockConfirmedBy = [];
    await conversation.save();

    res.status(200).json({ message: "Unlock request cancelled" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLockStatus = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    res.status(200).json({
      locked: conversation.locked,
      lockRequestedBy: conversation.lockRequestedBy,
      lockConfirmedBy: conversation.lockConfirmedBy,
      unlockRequestedBy: conversation.unlockRequestedBy,
      unlockConfirmedBy: conversation.unlockConfirmedBy,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { requestLock, confirmLock, rejectLock, requestUnlock, confirmUnlock, rejectUnlock, getLockStatus };