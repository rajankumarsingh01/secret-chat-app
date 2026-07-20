const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

const createSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const username = process.env.SUPERADMIN_USERNAME;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!username || !password) {
      console.log("SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD must be set in .env");
      process.exit(1);
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      console.log("Superadmin already exists with this username.");
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.create({
      username: username.toLowerCase(),
      password: hashedPassword,
      role: "superadmin",
    });

    console.log(`Superadmin created successfully with username: ${username}`);
    process.exit(0);
  } catch (error) {
    console.error("Error creating superadmin:", error.message);
    process.exit(1);
  }
};

createSuperAdmin();