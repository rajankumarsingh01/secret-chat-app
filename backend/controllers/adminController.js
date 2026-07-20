const User = require("../models/User");
const Message = require("../models/Message");

// @desc Get all users (for admin, includes banned users too)
const getAllUsersAdmin = async (req, res) => {
  try {
    const users = await User.find({ role: "user" }).select("-password");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Ban a user
const banUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: true },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Unban a user
const unbanUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: false },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Delete a user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    await Message.deleteMany({ $or: [{ sender: req.params.id }, { receiver: req.params.id }] });
    res.status(200).json({ message: "User and their messages deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get basic stats
const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const bannedUsers = await User.countDocuments({ role: "user", isBanned: true });
    const totalMessages = await Message.countDocuments();
    res.status(200).json({ totalUsers, bannedUsers, totalMessages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAllUsersAdmin, banUser, unbanUser, deleteUser, getStats };