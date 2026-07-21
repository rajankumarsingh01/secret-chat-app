const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const sendPushNotification = require("../utils/sendPushNotification");
const pushCopy = require("../config/pushCopy");

const onlineUsers = new Map();

// Returns the userIds of everyone this user shares a Conversation with — i.e. their
// paired contacts. Online/offline status should only ever go to these people, never
// to every connected socket (that was leaking presence info to total strangers).
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

// Emits presence changes only to paired contacts (each user has already joined a
// room named after their own userId — see socket.join(userId) below).
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

        const conversation = await Conversation.findOne({ participants: { $all: [userId, receiver] } });
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
            // Generic copy on purpose — never the sender's username or any message
            // content, since this can sit on a locked screen. See config/pushCopy.js.
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

    socket.on("message_deleted", ({ messageId, otherUserId }) => {
      io.to(otherUserId).emit("message_deleted_sync", { messageId });
    });

    // Sender/receiver both need to know a view-once message is gone the instant
    // it's opened, so it can't be re-shown from the other device's cache either.
    socket.on("view_once_opened", ({ messageId, otherUserId }) => {
      io.to(otherUserId).emit("view_once_opened_sync", { messageId });
      io.to(userId).emit("view_once_opened_sync", { messageId });
    });

    // Notify the partner in real time that a lock/unlock action happened — they should refresh state
    socket.on("lock_state_changed", ({ otherUserId }) => {
      io.to(otherUserId).emit("lock_state_sync");
    });

    // Fired when this user takes a screenshot inside an unlocked chat. We never see
    // the screenshot itself — the phone OS just tells the app "a screenshot happened"
    // — we only relay that fact to the other participant so they know their screen
    // was captured. No image, no content, ever leaves the device.
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

    socket.on("disconnect", async () => {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
      broadcastStatusToContacts(io, userId, false);
      console.log(`User disconnected: ${socket.user.username}`);
    });
  });
};

module.exports = socketHandler;