const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const sendPushNotification = require("../utils/sendPushNotification");

const onlineUsers = new Map();

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
    io.emit("user_status_changed", { userId, isOnline: true });

    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    socket.join(userId);

    socket.on("send_message", async (data) => {
      try {
        const { receiver, cipherText, nonce, imageUrl, replyTo } = data;

        if (!receiver || (!cipherText && !imageUrl)) {
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
          replyTo: replyTo || null,
          isDelivered: receiverIsConnected,
        });

        message = await message.populate("replyTo", "cipherText nonce imageUrl sender deletedForEveryone");

        io.to(receiver).emit("receive_message", message);
        io.to(userId).emit("receive_message", message);

        if (!receiverIsConnected) {
          const receiverUser = await User.findById(receiver).select("pushToken");
          if (receiverUser?.pushToken) {
            sendPushNotification(receiverUser.pushToken, socket.user.username, "New message", {
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

    // Notify the partner in real time that a lock/unlock action happened — they should refresh state
    socket.on("lock_state_changed", ({ otherUserId }) => {
      io.to(otherUserId).emit("lock_state_sync");
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
      io.emit("user_status_changed", { userId, isOnline: false });
      console.log(`User disconnected: ${socket.user.username}`);
    });
  });
};

module.exports = socketHandler;