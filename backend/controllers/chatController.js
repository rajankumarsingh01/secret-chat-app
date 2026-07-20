const Message = require("../models/Message");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const uploadToCloudinary = require("../utils/cloudinaryUpload");

const getSharedConversation = async (userId, otherUserId) => {
  return Conversation.findOne({ participants: { $all: [userId, otherUserId] } });
};

// Returns { allowed: bool, reason: string|null } — the single source of truth for whether
// userId can currently send a message to otherUserId
const canMessage = async (userId, otherUserId) => {
  const conversation = await getSharedConversation(userId, otherUserId);
  if (!conversation) return { allowed: false, reason: "You are not connected with this user" };

  const user = await User.findById(userId).select("lockedWith");
  if (user.lockedWith && user.lockedWith.toString() !== otherUserId.toString()) {
    return { allowed: false, reason: "You're locked with another partner right now" };
  }

  return { allowed: true, conversation };
};

const getMessages = async (req, res) => {
  try {
    const { otherUserId } = req.params;

    const conversation = await getSharedConversation(req.user._id, otherUserId);
    if (!conversation) {
      return res.status(403).json({ message: "You are not connected with this user" });
    }

    const { before, limit } = req.query;
    const limitNum = Math.min(parseInt(limit) || 30, 50);

    const query = {
      $or: [
        { sender: req.user._id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user._id },
      ],
      deletedFor: { $ne: req.user._id },
    };

    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .populate("replyTo", "cipherText nonce imageUrl sender deletedForEveryone");

    const hasMore = messages.length === limitNum;

    await Message.updateMany(
      { sender: otherUserId, receiver: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ messages, hasMore, locked: conversation.locked });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { receiver, cipherText, nonce } = req.body;

    if (!receiver || !cipherText || !nonce) {
      return res.status(400).json({ message: "Receiver, cipherText and nonce are required" });
    }

    const { allowed, reason } = await canMessage(req.user._id, receiver);
    if (!allowed) {
      return res.status(403).json({ message: reason });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver,
      cipherText,
      nonce,
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const uploadChatImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const result = await uploadToCloudinary(req.file.buffer, "chat-app/chat-images");

    res.status(200).json({ imageUrl: result.secure_url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc List all contacts (conversations) for the logged-in user, with last message + unread + lock info
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const me = await User.findById(userId).select("lockedWith");

    const conversations = await Conversation.find({ participants: userId }).populate(
      "participants",
      "username profilePicUrl isOnline lastSeen publicKey"
    );

    const results = await Promise.all(
      conversations.map(async (conv) => {
        const partner = conv.participants.find((p) => p._id.toString() !== userId.toString());

        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, receiver: partner._id },
            { sender: partner._id, receiver: userId },
          ],
          deletedFor: { $ne: userId },
        })
          .sort({ createdAt: -1 })
          .select("cipherText nonce imageUrl sender createdAt deletedForEveryone");

        const unreadCount = await Message.countDocuments({
          sender: partner._id,
          receiver: userId,
          isRead: false,
        });

        // Read-only if I'm locked with someone else (not this partner)
        const readOnly = !!(me.lockedWith && me.lockedWith.toString() !== partner._id.toString());

        return {
          conversationId: conv._id,
          partner,
          lastMessage: lastMessage || null,
          unreadCount,
          locked: conv.locked,
          readOnly,
        };
      })
    );

    results.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { mode } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const isParticipant =
      message.sender.toString() === req.user._id.toString() ||
      message.receiver.toString() === req.user._id.toString();
    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (mode === "everyone") {
      if (message.sender.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only the sender can delete for everyone" });
      }
      const ONE_HOUR = 60 * 60 * 1000;
      if (Date.now() - new Date(message.createdAt).getTime() > ONE_HOUR) {
        return res.status(400).json({ message: "This message is too old to delete for everyone" });
      }
      message.deletedForEveryone = true;
      message.cipherText = "";
      message.nonce = "";
      message.imageUrl = "";
      await message.save();
    } else {
      if (!message.deletedFor.includes(req.user._id)) {
        message.deletedFor.push(req.user._id);
        await message.save();
      }
    }

    res.status(200).json({ message: "Deleted", messageId, mode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  uploadChatImage,
  getConversations,
  deleteMessage,
  canMessage,
};