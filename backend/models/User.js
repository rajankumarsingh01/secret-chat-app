const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    recoveryCodeHash: {
      type: String,
      default: "",
    },
    profilePicUrl: {
      type: String,
      default: "",
    },
    publicKey: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "superadmin"],
      default: "user",
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    pushToken: {
      type: String,
      default: "",
    },
    pairingCode: {
      type: String,
      default: null,
    },
    pairingCodeExpiresAt: {
      type: Date,
      default: null,
    },
    lockedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);