const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // For 1-1 messages this is required. For group messages we use `conversation`
    // + `recipientCiphers` instead (a group has no single receiver).
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return !this.conversation;
      },
    },
    // Set ONLY for group messages — points at the group's Conversation doc.
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    cipherText: {
      type: String,
      default: "",
    },
    nonce: {
      type: String,
      default: "",
    },
    // Group text messages (Phase 5A): since our E2E is pairwise (nacl.box), the
    // sender encrypts the same plaintext once per group member's public key
    // (including their own, so they can re-read their own sent messages later).
    // Each entry is independently decryptable only by the matching `user`.
    recipientCiphers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        cipherText: String,
        nonce: String,
        _id: false,
      },
    ],
    // Group read receipts: who has marked this message read. (1-1 chats keep
    // using the older `isRead` boolean below — unchanged.)
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    imageUrl: {
      type: String,
      default: "",
    },
    audioUrl: {
      type: String,
      default: "",
    },
    audioDuration: {
      type: Number,
      default: 0,
    },
    mediaPublicId: {
      type: String,
      default: "",
    },
    viewOnce: {
      type: Boolean,
      default: false,
    },
    viewOnceOpened: {
      type: Boolean,
      default: false,
    },
    viewOnceOpenedAt: {
      type: Date,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isDelivered: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reaction: {
      type: String,
      default: "",
    },
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);