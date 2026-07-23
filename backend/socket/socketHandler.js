const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const sendPushNotification = require("../utils/sendPushNotification");
const pushCopy = require("../config/pushCopy");

const onlineUsers = new Map();

const getContactIds = async (userId) => {
  const conversations = await Conversation.find({ participants: userId }).select("participants");
  const contactIds = new Set();
  conversations.forEach((conv) => {
    conv.participants.forEach((p) => {
      const pid = p.toString();
      if (pid !== userId) contactIds.add(pid);
    });
  });
  return [...contactIds];
};

const broadcastStatusToContacts = async (io, userId, isOnline) => {
  try {
    const contactIds = await getContactIds(userId);
    contactIds.forEach((contactId) => {
      io.to(contactId).emit("user_status_changed", { userId, isOnline });
    });
  } catch (error) {
    console.log("broadcastStatusToContacts error:", error.message);
  }
};

const groupRoom = (conversationId) => `group_${conversationId}`;

const socketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication error: no token"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user || user.isBanned) {
        return next(new Error("Authentication error: invalid user"));
      }
      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    onlineUsers.set(userId, socket.id);

    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
    broadcastStatusToContacts(io, userId, true);

    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    socket.join(userId);

    // Join every group room this user belongs to, so group messages/events
    // reach them in real time without joining manually per-chat-open.
    try {
      const myGroups = await Conversation.find({ participants: userId, isGroup: true }).select("_id");
      myGroups.forEach((conv) => socket.join(groupRoom(conv._id)));
    } catch (error) {
      console.log("Error joining group rooms:", error.message);
    }

    socket.on("send_message", async (data) => {
      try {
        const {
          receiver,
          cipherText,
          nonce,
          imageUrl,
          audioUrl,
          audioDuration,
          mediaPublicId,
          viewOnce,
          replyTo,
        } = data;

        if (!receiver || (!cipherText && !imageUrl && !audioUrl)) {
          return socket.emit("error_message", { message: "Invalid message data" });
        }

        const conversation = await Conversation.findOne({
          isGroup: { $ne: true },
          participants: { $all: [userId, receiver] },
        });
        if (!conversation) {
          return socket.emit("error_message", { message: "You are not connected with this user" });
        }

        const senderUser = await User.findById(userId).select("lockedWith");
        if (senderUser.lockedWith && senderUser.lockedWith.toString() !== receiver) {
          return socket.emit("error_message", { message: "You're locked with another partner right now" });
        }

        const receiverIsConnected = onlineUsers.has(receiver);

        let message = await Message.create({
          sender: userId,
          receiver,
          cipherText: cipherText || "",
          nonce: nonce || "",
          imageUrl: imageUrl || "",
          audioUrl: audioUrl || "",
          audioDuration: audioDuration || 0,
          mediaPublicId: mediaPublicId || "",
          viewOnce: !!viewOnce,
          replyTo: replyTo || null,
          isDelivered: receiverIsConnected,
        });

        message = await message.populate("replyTo", "cipherText nonce imageUrl audioUrl sender deletedForEveryone viewOnce viewOnceOpened");

        io.to(receiver).emit("receive_message", message);
        io.to(userId).emit("receive_message", message);

        if (!receiverIsConnected) {
          const receiverUser = await User.findById(receiver).select("pushToken");
          if (receiverUser?.pushToken) {
            sendPushNotification(receiverUser.pushToken, pushCopy.title, pushCopy.body, {
              senderId: userId,
            });
          }
        } else {
          io.to(userId).emit("message_delivered", { messageId: message._id });
        }
      } catch (error) {
        socket.emit("error_message", { message: error.message });
      }
    });

    // ── Group messaging (Phase 5A) ──────────────────────────────────────────
    // Client sends the plaintext already encrypted N times — once per group
    // member's public key (see mobile crypto/e2e.js encryptForGroup).
    socket.on("send_group_message", async (data) => {
      try {
        const { conversationId, recipientCiphers, replyTo } = data;

        if (!conversationId || !Array.isArray(recipientCiphers) || recipientCiphers.length === 0) {
          return socket.emit("error_message", { message: "Invalid group message data" });
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          isGroup: true,
          participants: userId,
        });
        if (!conversation) {
          return socket.emit("error_message", { message: "You're not a member of this group" });
        }

        let message = await Message.create({
          sender: userId,
          conversation: conversationId,
          recipientCiphers,
          replyTo: replyTo || null,
        });

        message = await message.populate("sender", "username profilePicUrl");
        message = await message.populate("replyTo", "recipientCiphers sender deletedForEveryone");

        io.to(groupRoom(conversationId)).emit("receive_group_message", message);
      } catch (error) {
        socket.emit("error_message", { message: error.message });
      }
    });

    // Lets a socket that's already connected join a brand-new group's room
    // right after creating it (creator won't have joined it at connect-time
    // since the group didn't exist yet).
    socket.on("join_group_room", ({ conversationId }) => {
      if (conversationId) socket.join(groupRoom(conversationId));
    });

    socket.on("mark_read", async ({ otherUserId }) => {
      try {
        await Message.updateMany(
          { sender: otherUserId, receiver: userId, isRead: false },
          { $set: { isRead: true } }
        );
        io.to(otherUserId).emit("messages_seen", { by: userId });
      } catch (error) {
        console.log("mark_read error:", error.message);
      }
    });

    socket.on("mark_group_read", async ({ conversationId }) => {
      try {
        await Message.updateMany(
          { conversation: conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
        io.to(groupRoom(conversationId)).emit("group_messages_seen", { conversationId, by: userId });
      } catch (error) {
        console.log("mark_group_read error:", error.message);
      }
    });

    socket.on("react_message", async ({ messageId, emoji, otherUserId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        message.reaction = message.reaction === emoji ? "" : emoji;
        await message.save();

        io.to(userId).emit("message_reacted", { messageId, reaction: message.reaction });
        io.to(otherUserId).emit("message_reacted", { messageId, reaction: message.reaction });
      } catch (error) {
        console.log("react_message error:", error.message);
      }
    });

    socket.on("react_group_message", async ({ messageId, emoji, conversationId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        message.reaction = message.reaction === emoji ? "" : emoji;
        await message.save();

        io.to(groupRoom(conversationId)).emit("group_message_reacted", { messageId, reaction: message.reaction });
      } catch (error) {
        console.log("react_group_message error:", error.message);
      }
    });

    socket.on("message_deleted", ({ messageId, otherUserId }) => {
      io.to(otherUserId).emit("message_deleted_sync", { messageId });
    });

    socket.on("group_message_deleted", ({ messageId, conversationId }) => {
      io.to(groupRoom(conversationId)).emit("group_message_deleted_sync", { messageId });
    });

    socket.on("view_once_opened", ({ messageId, otherUserId }) => {
      io.to(otherUserId).emit("view_once_opened_sync", { messageId });
      io.to(userId).emit("view_once_opened_sync", { messageId });
    });

    socket.on("lock_state_changed", ({ otherUserId }) => {
      io.to(otherUserId).emit("lock_state_sync");
    });

    socket.on("screenshot_taken", ({ otherUserId }) => {
      if (!otherUserId) return;
      io.to(otherUserId).emit("screenshot_notice", { by: userId });
    });

    socket.on("typing", ({ receiver }) => {
      io.to(receiver).emit("user_typing", { senderId: userId });
    });

    socket.on("stop_typing", ({ receiver }) => {
      io.to(receiver).emit("user_stop_typing", { senderId: userId });
    });

    // socket.to() (not io.to()) excludes the sender's own socket automatically —
    // exactly what we want for a "X is typing" indicator.
    socket.on("group_typing", ({ conversationId }) => {
      socket.to(groupRoom(conversationId)).emit("group_user_typing", {
        conversationId,
        userId,
        username: socket.user.username,
      });
    });

    socket.on("group_stop_typing", ({ conversationId }) => {
      socket.to(groupRoom(conversationId)).emit("group_user_stop_typing", { conversationId, userId });
    });

    socket.on("disconnect", async () => {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
      broadcastStatusToContacts(io, userId, false);
      console.log(`User disconnected: ${socket.user.username}`);
    });
  });
};

module.exports = socketHandler;