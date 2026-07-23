// backend/controllers/chatController.js
const Message = require("../models/Message");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const uploadToCloudinary = require("../utils/cloudinaryUpload");
const { deleteFromCloudinary } = require("../utils/cloudinaryUpload");

const getSharedConversation = async (userId, otherUserId) => {
  return Conversation.findOne({ isGroup: { $ne: true }, participants: { $all: [userId, otherUserId] } });
};

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
      .populate("replyTo", "cipherText nonce imageUrl audioUrl sender deletedForEveryone viewOnce viewOnceOpened");

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

// @desc Message history for a GROUP conversation (Phase 5A)
const getGroupMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({ _id: conversationId, isGroup: true, participants: userId });
    if (!conversation) {
      return res.status(403).json({ message: "You're not a member of this group" });
    }

    const { before, limit } = req.query;
    const limitNum = Math.min(parseInt(limit) || 30, 50);

    const query = { conversation: conversationId, deletedFor: { $ne: userId } };
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) query.createdAt = { $lt: beforeDate };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .populate("sender", "username profilePicUrl")
      .populate("replyTo", "recipientCiphers sender deletedForEveryone");

    const hasMore = messages.length === limitNum;

    await Message.updateMany(
      { conversation: conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({ messages, hasMore });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc List your 1-1 contacts (used by the "Create group" member picker)
const getContacts = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({
      participants: userId,
      isGroup: { $ne: true },
    }).populate("participants", "username profilePicUrl isOnline publicKey");

    const contacts = conversations
      .map((conv) => conv.participants.find((p) => p._id.toString() !== userId.toString()))
      .filter(Boolean);

    res.status(200).json(contacts);
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

    res.status(200).json({ imageUrl: result.secure_url, mediaPublicId: result.public_id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const uploadVoiceMessage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No audio file provided" });
    }

    const duration = parseFloat(req.body.duration) || 0;

    const result = await uploadToCloudinary(req.file.buffer, "chat-app/chat-voice", "video");

    res.status(200).json({
      audioUrl: result.secure_url,
      audioDuration: duration,
      mediaPublicId: result.public_id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const openViewOnceMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the recipient can open this" });
    }

    if (!message.viewOnce) {
      return res.status(400).json({ message: "This message isn't a view-once message" });
    }

    if (message.viewOnceOpened) {
      return res.status(410).json({ message: "This media has already been viewed and removed" });
    }

    const resourceType = message.audioUrl ? "video" : "image";
    await deleteFromCloudinary(message.mediaPublicId, resourceType);

    message.viewOnceOpened = true;
    message.viewOnceOpenedAt = new Date();
    message.imageUrl = "";
    message.audioUrl = "";
    message.mediaPublicId = "";
    await message.save();

    res.status(200).json({ message: "Opened", messageId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc List all contacts AND groups for the logged-in user, with last message + unread
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
        // ── Group conversation ──────────────────────────────────────────
        if (conv.isGroup) {
          const lastMessage = await Message.findOne({
            conversation: conv._id,
            deletedFor: { $ne: userId },
          })
            .sort({ createdAt: -1 })
            .select("sender createdAt deletedForEveryone readBy");

          const unreadCount = await Message.countDocuments({
            conversation: conv._id,
            sender: { $ne: userId },
            readBy: { $ne: userId },
          });

          return {
            conversationId: conv._id,
            isGroup: true,
            groupName: conv.groupName,
            groupAvatarUrl: conv.groupAvatarUrl,
            participants: conv.participants,
            memberCount: conv.participants.length,
            lastMessage: lastMessage || null,
            unreadCount,
            locked: false,
            readOnly: false,
          };
        }

        // ── 1-1 conversation (unchanged) ────────────────────────────────
        const partner = conv.participants.find((p) => p._id.toString() !== userId.toString());
        if (!partner) return null;

        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, receiver: partner._id },
            { sender: partner._id, receiver: userId },
          ],
          deletedFor: { $ne: userId },
        })
          .sort({ createdAt: -1 })
          .select(
            "cipherText nonce imageUrl audioUrl sender createdAt deletedForEveryone isRead isDelivered viewOnce viewOnceOpened"
          );

        const unreadCount = await Message.countDocuments({
          sender: partner._id,
          receiver: userId,
          isRead: false,
        });

        const readOnly = !!(me.lockedWith && me.lockedWith.toString() !== partner._id.toString());

        return {
          conversationId: conv._id,
          isGroup: false,
          partner,
          lastMessage: lastMessage || null,
          unreadCount,
          locked: conv.locked,
          readOnly,
        };
      })
    );

    const filtered = results.filter(Boolean);

    filtered.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.status(200).json(filtered);
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

    let isParticipant =
      message.sender.toString() === req.user._id.toString() ||
      (message.receiver && message.receiver.toString() === req.user._id.toString());

    if (!isParticipant && message.conversation) {
      isParticipant = !!(await Conversation.exists({ _id: message.conversation, participants: req.user._id }));
    }

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
      if (message.mediaPublicId) {
        const resourceType = message.audioUrl ? "video" : "image";
        await deleteFromCloudinary(message.mediaPublicId, resourceType);
      }

      message.deletedForEveryone = true;
      message.cipherText = "";
      message.nonce = "";
      message.imageUrl = "";
      message.audioUrl = "";
      message.mediaPublicId = "";
      message.recipientCiphers = [];
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
  getGroupMessages,
  getContacts,
  sendMessage,
  uploadChatImage,
  uploadVoiceMessage,
  openViewOnceMessage,
  getConversations,
  deleteMessage,
  canMessage,
};