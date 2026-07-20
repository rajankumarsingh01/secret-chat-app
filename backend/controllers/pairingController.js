const User = require("../models/User");
const Conversation = require("../models/Conversation");

// @desc Generate a 6-digit code to let someone add you as a contact (expires in 20 min)
const generateCode = async (req, res) => {
  try {
    if (req.user.lockedWith) {
      return res.status(400).json({ message: "You're locked with a partner. Unlock first to add new contacts." });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    await User.findByIdAndUpdate(req.user._id, {
      pairingCode: code,
      pairingCodeExpiresAt: expiresAt,
    });

    res.status(200).json({ code, expiresAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Add a contact using their code — creates a Conversation between the two, non-exclusive
const connect = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: "Code is required" });
    }

    if (req.user.lockedWith) {
      return res.status(400).json({ message: "You're locked with a partner. Unlock first to add new contacts." });
    }

    const partner = await User.findOne({ pairingCode: code, role: "user" });

    if (!partner) {
      return res.status(400).json({ message: "Invalid code" });
    }
    if (partner._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot add yourself" });
    }
    if (!partner.pairingCodeExpiresAt || partner.pairingCodeExpiresAt < new Date()) {
      return res.status(400).json({ message: "This code has expired" });
    }
    if (partner.lockedWith) {
      return res.status(400).json({ message: "This user is currently locked with someone else" });
    }

    const existing = await Conversation.findOne({
      participants: { $all: [req.user._id, partner._id] },
    });
    if (existing) {
      return res.status(400).json({ message: "You're already connected with this user" });
    }

    await User.findByIdAndUpdate(partner._id, { pairingCode: null, pairingCodeExpiresAt: null });

    const conversation = await Conversation.create({
      participants: [req.user._id, partner._id],
    });

    res.status(200).json({
      message: "Contact added successfully",
      conversationId: conversation._id,
      partner: {
        _id: partner._id,
        username: partner.username,
        profilePicUrl: partner.profilePicUrl,
        isOnline: partner.isOnline,
        publicKey: partner.publicKey,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { generateCode, connect };