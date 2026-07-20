const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const generateRecoveryCode = require("../utils/generateRecoveryCode");

// @desc Signup a new user
const signup = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const recoveryCode = generateRecoveryCode();
    const recoveryCodeHash = await bcrypt.hash(recoveryCode, salt);

    const user = await User.create({
      username: username.toLowerCase(),
      password: hashedPassword,
      recoveryCodeHash,
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      profilePicUrl: user.profilePicUrl,
      role: user.role,
      token: generateToken(user._id, user.role),
      recoveryCode, // shown ONCE — never stored or returned again in plaintext
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Login user or superadmin
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: "Your account has been banned" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    res.status(200).json({
      _id: user._id,
      username: user.username,
      profilePicUrl: user.profilePicUrl,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get logged-in user's own profile
const getMe = async (req, res) => {
  res.status(200).json(req.user);
};

// @desc Reset password using the one-time recovery code, then issue a new one
const resetPassword = async (req, res) => {
  try {
    const { username, recoveryCode, newPassword } = req.body;

    if (!username || !recoveryCode || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !user.recoveryCodeHash) {
      return res.status(400).json({ message: "Invalid username or recovery code" });
    }

    const isMatch = await bcrypt.compare(recoveryCode.toUpperCase().trim(), user.recoveryCodeHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or recovery code" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    const newRecoveryCode = generateRecoveryCode();
    user.recoveryCodeHash = await bcrypt.hash(newRecoveryCode, salt);

    await user.save();

    res.status(200).json({
      message: "Password reset successful",
      newRecoveryCode, // the old code is now invalid — this replaces it, shown once
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { signup, login, getMe, resetPassword };