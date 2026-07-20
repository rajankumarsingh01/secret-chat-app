const User = require("../models/User");
const uploadToCloudinary = require("../utils/cloudinaryUpload");

const uploadProfilePic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const result = await uploadToCloudinary(req.file.buffer, "chat-app/profile-pics");

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicUrl: result.secure_url },
      { new: true }
    ).select("-password");

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const savePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ message: "Push token is required" });
    }

    await User.findByIdAndUpdate(req.user._id, { pushToken });
    res.status(200).json({ message: "Push token saved" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { uploadProfilePic, savePushToken };