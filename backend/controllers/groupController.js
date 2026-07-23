const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// Privacy invariant: you can only ever add someone to a group if they're already
// your 1-1 contact (paired via a code). There's no global user search in this
// app on purpose — this keeps that same invariant for groups.
const isContactOf = async (userId, otherUserId) => {
  const conv = await Conversation.findOne({
    isGroup: { $ne: true },
    participants: { $all: [userId, otherUserId] },
  });
  return !!conv;
};

const requireAdmin = (conversation, userId) =>
  conversation.groupAdmins.some((id) => id.toString() === userId.toString());

// @desc Create a group from your existing contacts
const createGroup = async (req, res) => {
  try {
    const { groupName, memberIds } = req.body;
    const creatorId = req.user._id.toString();

    if (!groupName || !groupName.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: "memberIds must be an array" });
    }

    const uniqueMemberIds = [...new Set(memberIds.map(String))].filter((id) => id !== creatorId);
    if (uniqueMemberIds.length < 2) {
      return res.status(400).json({ message: "Pick at least 2 contacts to start a group" });
    }

    for (const memberId of uniqueMemberIds) {
      const ok = await isContactOf(creatorId, memberId);
      if (!ok) {
        return res.status(400).json({ message: "You can only add people from your existing contacts" });
      }
    }

    const conversation = await Conversation.create({
      participants: [creatorId, ...uniqueMemberIds],
      isGroup: true,
      groupName: groupName.trim(),
      groupAdmins: [creatorId],
      createdBy: creatorId,
    });

    const populated = await conversation.populate(
      "participants",
      "username profilePicUrl isOnline publicKey"
    );

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Full group info — members, admins, etc (must be a participant)
const getGroupInfo = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      participants: req.user._id,
    }).populate("participants", "username profilePicUrl isOnline lastSeen publicKey");

    if (!conversation) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Rename group (admin only)
const renameGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { groupName } = req.body;
    if (!groupName || !groupName.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      participants: req.user._id,
    });
    if (!conversation) return res.status(404).json({ message: "Group not found" });
    if (!requireAdmin(conversation, req.user._id)) {
      return res.status(403).json({ message: "Only group admins can rename the group" });
    }

    conversation.groupName = groupName.trim();
    await conversation.save();

    res.status(200).json({ message: "Group renamed", groupName: conversation.groupName });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Add members (admin only, must be adder's own contacts)
const addMembers = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { memberIds } = req.body;
    const actingUserId = req.user._id.toString();

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "Pick at least one contact to add" });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      participants: req.user._id,
    });
    if (!conversation) return res.status(404).json({ message: "Group not found" });
    if (!requireAdmin(conversation, req.user._id)) {
      return res.status(403).json({ message: "Only group admins can add members" });
    }

    const toAdd = [];
    for (const memberId of memberIds.map(String)) {
      if (conversation.participants.some((p) => p.toString() === memberId)) continue;
      const ok = await isContactOf(actingUserId, memberId);
      if (!ok) {
        return res.status(400).json({ message: "You can only add people from your existing contacts" });
      }
      toAdd.push(memberId);
    }

    conversation.participants.push(...toAdd);
    await conversation.save();

    const populated = await conversation.populate(
      "participants",
      "username profilePicUrl isOnline publicKey"
    );
    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Remove a member (admin only, creator can't be removed)
const removeMember = async (req, res) => {
  try {
    const { conversationId, memberId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      participants: req.user._id,
    });
    if (!conversation) return res.status(404).json({ message: "Group not found" });
    if (!requireAdmin(conversation, req.user._id)) {
      return res.status(403).json({ message: "Only group admins can remove members" });
    }
    if (conversation.createdBy && memberId === conversation.createdBy.toString()) {
      return res.status(400).json({ message: "The group creator can't be removed" });
    }

    conversation.participants = conversation.participants.filter((p) => p.toString() !== memberId);
    conversation.groupAdmins = conversation.groupAdmins.filter((p) => p.toString() !== memberId);
    await conversation.save();

    res.status(200).json({ message: "Member removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Leave a group (auto-promotes the earliest remaining member if the last admin leaves)
const leaveGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      participants: req.user._id,
    });
    if (!conversation) return res.status(404).json({ message: "Group not found" });

    conversation.participants = conversation.participants.filter((p) => p.toString() !== userId);
    const wasAdmin = conversation.groupAdmins.some((p) => p.toString() === userId);
    conversation.groupAdmins = conversation.groupAdmins.filter((p) => p.toString() !== userId);

    if (wasAdmin && conversation.groupAdmins.length === 0 && conversation.participants.length > 0) {
      conversation.groupAdmins.push(conversation.participants[0]);
    }

    if (conversation.participants.length === 0) {
      await Conversation.findByIdAndDelete(conversationId);
      await Message.deleteMany({ conversation: conversationId });
    } else {
      await conversation.save();
    }

    res.status(200).json({ message: "Left group" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createGroup, getGroupInfo, renameGroup, addMembers, removeMember, leaveGroup, isContactOf };