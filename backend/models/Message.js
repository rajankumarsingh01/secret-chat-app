const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cipherText: {
      type: String,
      default: "",
    },
    nonce: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    audioUrl: {
      type: String,
      default: "",
    },
    audioDuration: {
      // duration of the voice note in seconds (client-measured)
      type: Number,
      default: 0,
    },
    // Cloudinary public_id for whichever media (image/audio) this message carries.
    // Needed so we can actually delete the asset from Cloudinary on view-once open
    // or "delete for everyone", instead of just hiding the URL.
    mediaPublicId: {
      type: String,
      default: "",
    },
    // "Read once" media — once the receiver opens it, the media is deleted
    // from the server/Cloudinary for both sides.
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

module.exports = mongoose.model("Message", messageSchema);