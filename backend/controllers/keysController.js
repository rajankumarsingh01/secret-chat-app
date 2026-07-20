const User = require("../models/User");

// @desc Register/update the logged-in user's public key (private key never leaves the device)
const registerKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({ message: "Public key is required" });
    }

    await User.findByIdAndUpdate(req.user._id, { publicKey });
    res.status(200).json({ message: "Public key registered" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerKey };